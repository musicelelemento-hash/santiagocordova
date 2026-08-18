
export function arePeriodsEqual(p1?: string, p2?: string): boolean {
    if (!p1 || !p2) return false;
    const clean1 = p1.split(':')[0].trim().toUpperCase();
    const clean2 = p2.split(':')[0].trim().toUpperCase();
    if (clean1 === clean2) return true;

    const norm1 = clean1.replace('-1S', '-S1').replace('1S', 'S1').replace('-2S', '-S2').replace('2S', 'S2');
    const norm2 = clean2.replace('-1S', '-S1').replace('1S', 'S1').replace('-2S', '-S2').replace('2S', 'S2');
    if (norm1 === norm2) return true;

    const y1 = clean1.match(/\b(20\d{2})\b/)?.[1];
    const y2 = clean2.match(/\b(20\d{2})\b/)?.[1];
    if (y1 && y2 && y1 !== y2) return false;

    const isS1_1 = norm1.includes('S1') || norm1.endsWith('-06');
    const isS1_2 = norm2.includes('S1') || norm2.endsWith('-06');
    if (isS1_1 && isS1_2 && y1 === y2) return true;

    const isS2_1 = norm1.includes('S2') || norm1.endsWith('-12');
    const isS2_2 = norm2.includes('S2') || norm2.endsWith('-12');
    if (isS2_1 && isS2_2 && y1 === y2) return true;

    return false;
}

export function getP12RemainingDays(client: Client): number | null {
    if (!client.signatureExpirationDate) return null;
    const expDate = new Date(client.signatureExpirationDate);
    if (isNaN(expDate.getTime())) return null;
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus, IvaFrequency, Declaration, TaxRegime, TaxObligationType } from '../../types';
import { formatPeriodForDisplay, getPeriod, getDueDateForPeriod, downloadStoredFile, isSriPasswordUpdated } from '../../services/sri';
import { format, subMonths, startOfMonth, endOfMonth, isPast, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClientCompliance, getObligationsForPeriod, isPeriodBeforeClientStart } from '../../services/complianceEngine';
import { useToast } from '../../context/ToastContext';

import { SriCampaignWidget } from './SriCampaignWidget';
import { getNinthDigit } from '../../services/sri';

import { db } from '../../services/db';
import { useAppStore } from '../../store/useAppStore';
import { getClientServiceFee } from '../../services/clientService';
import { UnifiedStorageService } from '../../services/unifiedStorageService';
import { SupabaseService } from '../../services/supabaseClientService';
import { sendBatchDeclarationToExtension, listenForDeclarationCompleted, sendToSRIExtension, sendFullClientsMatrixToExtension } from '../../services/extensionBridge';

type MatrixMode = 'IVA' | 'RENTA';

export function formatDeclarationInvoiceDescription(period: string, obType: TaxObligationType = 'IVA'): { description: string; fiscalPeriod: string } {
    const monthNames = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    
    let monthName = '';
    let year = new Date().getFullYear().toString();

    const yyyymmMatch = period.match(/(\d{4})-(\d{2})/);
    if (yyyymmMatch) {
        year = yyyymmMatch[1];
        const mNum = parseInt(yyyymmMatch[2], 10);
        if (mNum >= 1 && mNum <= 12) {
            monthName = monthNames[mNum - 1];
        }
    } else if (period.includes('S1') || period.includes('1S') || period.endsWith('-06')) {
        const yMatch = period.match(/\b(20\d{2})\b/);
        if (yMatch) year = yMatch[1];
        monthName = '1er SEMESTRE';
    } else if (period.includes('S2') || period.includes('2S') || period.endsWith('-12')) {
        const yMatch = period.match(/\b(20\d{2})\b/);
        if (yMatch) year = yMatch[1];
        monthName = '2do SEMESTRE';
    } else {
        const yMatch = period.match(/\b(20\d{2})\b/);
        if (yMatch) year = yMatch[1];
        for (const m of monthNames) {
            if (period.toUpperCase().includes(m)) {
                monthName = m;
                break;
            }
        }
        if (!monthName) monthName = period.toUpperCase();
    }

    const typeLabel = obType === 'RENTA' ? 'DECLARACION RENTA' : 'DECLARACION IVA';
    const description = `${typeLabel} ${monthName} ${year}`.trim();
    const fiscalPeriod = monthName || 'JULIO';

    return { description, fiscalPeriod };
}

interface TaxComplianceMatrixProps {
    clients: Client[];
    onViewClient: (client: Client) => void;
    onUploadReceipt: (client: Client, period: string, type: TaxObligationType) => void;
    onPreviewReceipt: (client: Client, declaration: Declaration) => void;
    onTogglePayment?: (client: Client, period: string, type: TaxObligationType, isPaid: boolean) => void;
    onTogglePriority?: (client: Client, period: string, type: TaxObligationType, isPriority: boolean) => void;
    onNavigateToBilling?: (clientRuc: string, period?: string, description?: string) => void;
    theme?: 'light' | 'dark';
    initialMode?: MatrixMode;
}

export const TaxComplianceMatrix: React.FC<TaxComplianceMatrixProps> = ({ 
    clients, 
    onViewClient, 
    onUploadReceipt, 
    onPreviewReceipt,
    onTogglePayment,
    onTogglePriority,
    onNavigateToBilling,
    theme = 'dark',
    initialMode = 'IVA'
}) => {
    const { toast } = useToast();
    const { serviceFees } = useAppStore();
    const [frequency, setFrequency] = useState<IvaFrequency>('Mensual');
    const [matrixMode, setMatrixMode] = useState<MatrixMode>(initialMode);
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [copiedRuc, setCopiedRuc] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [densityMode, setDensityMode] = useState<'compact' | 'detailed'>(() => {
        return (localStorage.getItem('sc_matrix_density') as 'compact' | 'detailed') || 'compact';
    });

    const handleToggleDensity = (mode: 'compact' | 'detailed') => {
        setDensityMode(mode);
        localStorage.setItem('sc_matrix_density', mode);
    };

    const [highlightedRuc, setHighlightedRuc] = useState<string | null>(() => {
        return sessionStorage.getItem('matrix_highlight_ruc') || null;
    });

    React.useEffect(() => {
        const checkHighlight = () => {
            const h = sessionStorage.getItem('matrix_highlight_ruc');
            if (h) {
                setHighlightedRuc(h);
                const timer = setTimeout(() => {
                    setHighlightedRuc(null);
                    sessionStorage.removeItem('matrix_highlight_ruc');
                }, 5000);
                return () => clearTimeout(timer);
            }
        };
        checkHighlight();
    }, []);

    // Floating Command Dock Scroll & Opacity Tracking
    const [scrollY, setScrollY] = useState(0);

    // ELITE RPA: Escuchar sincronización de declaraciones en bucle
    React.useEffect(() => {
        const cleanup = listenForDeclarationCompleted((data: any) => {
            if (data && data.ruc) {
                toast.success(`Declaración del RUC ${data.ruc} subida automáticamente y sesión cerrada.`);
                
                // Buscar cliente
                const client = clients.find(c => c.ruc.replace(/\D/g, '') === data.ruc.replace(/\D/g, ''));
                if (client) {
                    onUploadReceipt(client, data.period && data.period !== 'AUTO' ? data.period : format(subMonths(new Date(), 1), 'yyyy-MM'), matrixMode);
                }
            }
        });
        return cleanup;
    }, [clients, matrixMode, onUploadReceipt, toast]);

    React.useEffect(() => {
        const handleScroll = () => {
            const mainEl = document.querySelector('main');
            const currentScroll = Math.max(
                window.scrollY || 0,
                document.documentElement?.scrollTop || 0,
                mainEl ? mainEl.scrollTop : 0
            );
            setScrollY(currentScroll);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        document.addEventListener('scroll', handleScroll, { passive: true });
        const mainEl = document.querySelector('main');
        if (mainEl) {
            mainEl.addEventListener('scroll', handleScroll, { passive: true });
        }

        handleScroll();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            document.removeEventListener('scroll', handleScroll);
            if (mainEl) {
                mainEl.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);
    
    // SRI Authorized Invoices History
    const [sriHistory, setSriHistory] = useState<any[]>([]);
    const [modalTab, setModalTab] = useState<'declaracion' | 'factura' | 'respaldos'>('declaracion');
    const [isUploadingProof, setIsUploadingProof] = useState(false);
    const [isOptimizingStorage, setIsOptimizingStorage] = useState(false);
    const [activeCellModal, setActiveCellModal] = useState<{
        client: Client;
        period: string;
        declaration: Declaration;
        obType: TaxObligationType;
        realInvoice: any | null;
    } | null>(null);

    const handleUploadProofPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeCellModal) return;
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
            toast.error("Por favor seleccione un archivo PDF válido");
            return;
        }

        setIsUploadingProof(true);
        toast.info("Subiendo comprobante al almacenamiento en la nube (Cloudflare R2 / Supabase Storage)...");

        try {
            const periodStr = activeCellModal.period;
            const mainObType = activeCellModal.declaration?.type || (matrixMode === 'RENTA' ? 'RENTA' : 'IVA');
            const fileName = `Declaracion_${mainObType}_${activeCellModal.client.ruc}_${periodStr}.pdf`;

            // Subir directamente a la nube (R2 / Supabase Storage bucket)
            const storedFile = await UnifiedStorageService.uploadFile(
                file,
                fileName,
                'declaraciones',
                {
                    period: periodStr,
                    uploadedAt: new Date().toISOString()
                }
            );

            // Asegurar que content sea null para no sobrecargar la base de datos de Supabase con Base64
            const cloudStoredFile = {
                ...storedFile,
                content: null // 💡 Cero base64 en la base de datos = Cero gasto innecesario de almacenamiento
            };

            const existingDecls = activeCellModal.client.declarations || [];
            const declIndex = existingDecls.findIndex(d => arePeriodsEqual(d.period, periodStr) && (d.type === mainObType || !d.type));

            let updatedDecls: Declaration[];
            if (declIndex >= 0) {
                updatedDecls = existingDecls.map((d, idx) => {
                    if (idx === declIndex) {
                        return {
                            ...d,
                            status: DeclarationStatus.Enviada,
                            proof_file: cloudStoredFile,
                            declaredAt: d.declaredAt || new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                    }
                    return d;
                });
            } else {
                updatedDecls = [
                    ...existingDecls,
                    {
                        period: periodStr,
                        type: mainObType as TaxObligationType,
                        status: DeclarationStatus.Enviada,
                        proof_file: cloudStoredFile,
                        declaredAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ];
            }

            // Actualizar en store y Supabase
            await useAppStore.getState().updateClient(activeCellModal.client.id, { declarations: updatedDecls });

            // Actualizar modal activo
            const updatedDecl = updatedDecls.find(d => arePeriodsEqual(d.period, periodStr))!;
            setActiveCellModal({
                ...activeCellModal,
                declaration: updatedDecl
            });

            toast.success("✅ Comprobante PDF almacenado en la nube con éxito. Base de datos optimizada.");
        } catch (err: any) {
            console.error("Error al subir comprobante a la nube:", err);
            toast.error("Error al subir archivo a la nube: " + (err.message || "Fallo de conexión"));
        } finally {
            setIsUploadingProof(false);
        }
    };

    const handleOptimizeSupabaseStorage = async () => {
        setIsOptimizingStorage(true);
        toast.info("Escaneando declaraciones con base64 para migrar a Cloud Storage y reducir gastos de Supabase...");

        let migratedCount = 0;
        let bytesSaved = 0;

        try {
            for (const client of clients) {
                let clientModified = false;
                const updatedDeclarations = (client.declarations || []).map((d) => {
                    if (d.proof_file && d.proof_file.content && !d.proof_file.url) {
                        clientModified = true;
                        migratedCount++;
                        bytesSaved += d.proof_file.size || d.proof_file.content.length;
                        return d;
                    }
                    return d;
                });

                if (clientModified) {
                    for (let i = 0; i < updatedDeclarations.length; i++) {
                        const decl = updatedDeclarations[i];
                        if (decl.proof_file && decl.proof_file.content && !decl.proof_file.url) {
                            try {
                                const fileName = decl.proof_file.name || `Declaracion_${decl.type || 'IVA'}_${client.ruc}_${decl.period}.pdf`;
                                const cloudFile = await UnifiedStorageService.uploadFile(
                                    decl.proof_file.content,
                                    fileName,
                                    'declaraciones',
                                    decl.proof_file.metadata
                                );
                                updatedDeclarations[i] = {
                                    ...decl,
                                    proof_file: {
                                        ...cloudFile,
                                        content: null // 💡 Eliminar base64 de la BD
                                    }
                                };
                            } catch (uploadErr) {
                                console.warn("Fallo al migrar declaración a la nube:", decl.period, uploadErr);
                            }
                        }
                    }

                    await useAppStore.getState().updateClient(client.id, { declarations: updatedDeclarations });
                }
            }

            const mbSaved = (bytesSaved / (1024 * 1024)).toFixed(2);
            if (migratedCount > 0) {
                toast.success(`🎉 ¡Optimización completada! ${migratedCount} comprobantes migrados a Cloud Storage. ${mbSaved} MB liberados de Supabase.`);
            } else {
                toast.info("✨ Todas tus declaraciones ya se encuentran 100% optimizadas en la nube. Cero gasto extra en Supabase.");
            }
        } catch (err: any) {
            console.error("Error en optimización de almacenamiento:", err);
            toast.error("Error durante la optimización: " + err.message);
        } finally {
            setIsOptimizingStorage(false);
        }
    };

    React.useEffect(() => {
        const loadHistory = async () => {
            try {
                const stored = (await db.getLocal('sc_sri_comprobantes_history')) || JSON.parse(localStorage.getItem('sc_sri_comprobantes_history') || '[]');
                setSriHistory(Array.isArray(stored) ? stored : []);
            } catch (err) {
                console.error('Error loading SRI history in matrix:', err);
            }
        };
        loadHistory();
    }, []);



    const findRealInvoice = (clientRuc: string, d?: Declaration, periodKey?: string) => {
        if (!sriHistory || sriHistory.length === 0) return null;
        const cleanRuc = clientRuc.replace(/\D/g, '');
        
        // 1. Direct match by secuencial if recorded in declaration
        const declSec = (d as any)?.invoice_secuencial || (d?.transactionId?.startsWith('001-') ? d.transactionId : null);
        if (declSec) {
            const found = sriHistory.find(h => h.estado === 'Autorizado' && (h.secuencial === declSec || h.secuencial?.endsWith(declSec)));
            if (found) return found;
        }

        const targetPeriodStr = (periodKey || d?.period || '').toUpperCase();
        if (!targetPeriodStr) return null;

        const monthNames = [
            'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
            'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
        ];

        let targetMonthName = '';
        let targetYear = '';

        const yyyymmMatch = targetPeriodStr.match(/(\d{4})-(\d{2})/);
        if (yyyymmMatch) {
            targetYear = yyyymmMatch[1];
            const mNum = parseInt(yyyymmMatch[2], 10);
            if (mNum >= 1 && mNum <= 12) {
                targetMonthName = monthNames[mNum - 1];
            }
        } else {
            const yearMatch = targetPeriodStr.match(/\b(20\d{2})\b/);
            if (yearMatch) targetYear = yearMatch[1];

            for (const m of monthNames) {
                if (targetPeriodStr.includes(m)) {
                    targetMonthName = m;
                    break;
                }
            }
        }

        // 2. Match by client RUC AND specific month/year period in authorized invoices
        const matches = sriHistory.filter(h => {
            if (h.estado !== 'Autorizado' || (h.tipo && h.tipo !== 'factura')) return false;
            const rucMatch = (h.rucReceptor?.replace(/\D/g, '') === cleanRuc);
            if (!rucMatch) return false;

            const invPeriod = (h.periodo || '').toUpperCase();
            if (invPeriod && (invPeriod === targetPeriodStr || (targetMonthName && invPeriod.includes(targetMonthName)))) {
                return true;
            }

            const invDesc = (
                (h.descripcion || '') + ' ' + 
                (Array.isArray(h.detalles) ? h.detalles.map((det: any) => det.descripcion || '').join(' ') : '') + ' ' +
                (h.periodoFiscal || '')
            ).toUpperCase();

            if (targetMonthName && targetYear) {
                return invDesc.includes(targetMonthName) && invDesc.includes(targetYear);
            } else if (targetMonthName) {
                return invDesc.includes(targetMonthName);
            } else if (targetPeriodStr) {
                return invDesc.includes(targetPeriodStr);
            }

            return false;
        });

        if (matches.length === 0) return null;
        matches.sort((a, b) => new Date(b.fechaEmision || 0).getTime() - new Date(a.fechaEmision || 0).getTime());
        return matches[0];
    };

    const printRideFromInvoice = (comprobante: any, clientObj: Client) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permita las ventanas emergentes (popups) para imprimir el RIDE.');
            return;
        }
        const emisorRuc = localStorage.getItem('sc_emisor_ruc') || '0705787745001';
        const emisorRazon = localStorage.getItem('sc_emisor_razon_social') || 'CORDOVA RAMIREZ ROBERTO SANTIAGO';
        const emisorComercial = localStorage.getItem('sc_emisor_nombre_comercial') || 'SOLUCIONES CONTABLES PRO';
        const emisorDir = localStorage.getItem('sc_emisor_dir_matriz') || 'PASAJE, EL ORO';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <title>RIDE_Factura_${comprobante.secuencial}</title>
                <meta charset="utf-8" />
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Manrope:wght@700;800;900&display=swap');
                    @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
                    * { box-sizing: border-box; }
                    body { font-family: 'Inter', sans-serif; font-size: 9.5px; color: #0f172a; margin: 20px; background: #fff; line-height: 1.4; }
                    .ride-top-accent { height: 4px; width: 100%; background: linear-gradient(90deg, #2B6AFF 0%, #6366F1 50%, #04B17B 100%); border-radius: 4px 4px 0 0; margin-bottom: 15px; }
                    .grid-container { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; margin-bottom: 16px; }
                    .emisor-title { font-family: 'Manrope', sans-serif; font-size: 17px; font-weight: 900; color: #0f172a; margin-bottom: 6px; }
                    .auth-box { border: 1.5px solid #0f172a; border-radius: 14px; padding: 14px; background: #f8fafc; }
                    .auth-doc-type { font-family: 'Manrope', sans-serif; font-size: 15px; font-weight: 900; color: #0f172a; margin: 2px 0 4px 0; }
                    .auth-secuencial { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #2b6aff; margin-bottom: 8px; }
                    .receptor-box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: grid; grid-template-columns: 1.3fr 1fr; gap: 8px; background: #fafafa; }
                    .items-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; }
                    .items-table th { background: #0f172a; color: #fff; font-family: 'Manrope', sans-serif; font-size: 8px; font-weight: 800; padding: 8px 10px; text-transform: uppercase; }
                    .items-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; font-size: 9.5px; }
                    .totals-box { border: 1.5px solid #0f172a; border-radius: 14px; padding: 12px 14px; background: #f8fafc; }
                    .totals-table { width: 100%; border-collapse: collapse; }
                    .totals-table td { padding: 4px 2px; border-bottom: 1px dashed #e2e8f0; font-size: 9px; }
                    .totals-table tr.total-row { background: #0f172a; color: #fff; font-weight: 800; }
                    .totals-table tr.total-row td { color: #fff; padding: 8px 6px; font-family: 'Manrope', sans-serif; }
                    @media print { .no-print { display: none !important; } body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="no-print" style="background: #0f172a; padding: 12px 20px; margin: -20px -20px 20px -20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2b6aff;">
                    <div style="color: white; font-family: 'Manrope', sans-serif; font-size: 11px; font-weight: 800;">📄 COMPROBANTE AUTORIZADO SRI</div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.print()" style="background: #2b6aff; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 10px; font-weight: 800; cursor: pointer;">📥 Descargar PDF / Imprimir</button>
                        <button onclick="window.close()" style="background: #334155; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 10px; font-weight: 800; cursor: pointer;">Cerrar</button>
                    </div>
                </div>
                <div class="ride-top-accent"></div>
                <div class="grid-container">
                    <div>
                        <div class="emisor-title">${emisorComercial}</div>
                        <div style="font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">${emisorRazon}</div>
                        <div><strong>Dirección Matriz:</strong> ${emisorDir}</div>
                        <div><strong>OBLIGADO A LLEVAR CONTABILIDAD:</strong> NO</div>
                        <div style="font-size: 8.5px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-top: 6px; padding: 4px 8px; background: #f1f5f9; border-left: 3px solid #04b17b; border-radius: 4px; display: inline-block;">CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE</div>
                    </div>
                    <div class="auth-box">
                        <div>R.U.C.: <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">${emisorRuc}</span></div>
                        <div class="auth-doc-type">FACTURA</div>
                        <div class="auth-secuencial">No. 001-001-${comprobante.secuencial}</div>
                        <div style="font-size: 8.5px; word-break: break-all; margin-top: 6px;"><strong>AUTORIZACIÓN:</strong> ${comprobante.claveAcceso}</div>
                        <div style="font-size: 8.5px; margin-top: 4px;"><strong>FECHA:</strong> ${comprobante.fechaEmision}</div>
                    </div>
                </div>
                <div class="receptor-box">
                    <div><strong>Razón Social:</strong> <div style="font-weight: 700; text-transform: uppercase;">${clientObj.tradeName || clientObj.name}</div></div>
                    <div><strong>RUC / Cédula:</strong> <div style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">${clientObj.ruc}</div></div>
                </div>
                <table class="items-table">
                    <thead><tr><th>Código</th><th style="text-align: center;">Cant.</th><th>Descripción</th><th style="text-align: right;">P. Unitario</th><th style="text-align: right;">Total</th></tr></thead>
                    <tbody><tr><td style="font-family: 'JetBrains Mono', monospace;">001</td><td style="text-align: center;">1.00</td><td style="text-transform: uppercase;">Servicios Contables Profesionales</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$${Number(comprobante.total || 0).toFixed(2)}</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 700;">$${Number(comprobante.total || 0).toFixed(2)}</td></tr></tbody>
                </table>
                <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px;">
                    <div></div>
                    <div class="totals-box">
                        <table class="totals-table">
                            <tr><td>SUBTOTAL SIN IMPUESTOS</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$${Number(comprobante.total || 0).toFixed(2)}</td></tr>
                            <tr class="total-row"><td>VALOR TOTAL</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$${Number(comprobante.total || 0).toFixed(2)}</td></tr>
                        </table>
                    </div>
                </div>
                <script>window.onload = function() { setTimeout(function() { window.print(); }, 350); };</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };
    
    // Period, Alphabetical & Color Priority Sorting State
    const [sortPeriod, setSortPeriod] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'missing_first' | 'completed_first' | null>(null);
    const [selectedDigitFilter, setSelectedDigitFilter] = useState<number | null>(null);
    const [sortOption, setSortOption] = useState<'9th_digit' | 'alphabetical' | 'color_orange' | 'color_red' | 'color_green' | 'color_priority'>('9th_digit');

    // Helper: Saludo dinámico según horario local (Buen día, Buenas tardes, Buenas noches)
    const getTimeBasedGreeting = (): string => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return '¡Buen día!';
        if (hour >= 12 && hour < 19) return '¡Buenas tardes!';
        return '¡Buenas noches!';
    };

    const handleOpenSriPortal = (client: Client, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

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
        } catch (err) {
            console.error("Error setting active SRI credentials:", err);
        }

        sendToSRIExtension(client);

        toast.success(
            `🔑 Credenciales de ${client.name} enviadas a la extensión SRI. RUC: ${client.ruc} ${client.sriPassword ? '· Clave lista para autocompletar' : ''}`
        );

        window.open("https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT", "_blank");
    };

    // Alternar estado de Notificado WhatsApp manualmente
    const handleToggleWhatsAppNotification = (client: Client, period: string, obType: string, decl?: Declaration) => {
        const declarations = client.declarations || [];
        const existingDecl = findDeclarationForOb(declarations, period, obType);
        
        const nowIso = new Date().toISOString();
        const currentNotified = !!existingDecl?.isNotifiedWhatsApp;
        const newNotifiedStatus = !currentNotified;

        let updatedDeclarations: Declaration[];
        if (existingDecl) {
            updatedDeclarations = declarations.map(d => {
                const matchPeriod = arePeriodsEqual(d.period, period) || d.period === period;
                const matchType = d.type === obType || (!d.type && (obType === 'IVA' || obType === 'RENTA'));
                if (matchPeriod && matchType) {
                    return {
                        ...d,
                        isNotifiedWhatsApp: newNotifiedStatus,
                        notifiedWhatsAppAt: newNotifiedStatus ? nowIso : undefined,
                        updatedAt: nowIso
                    };
                }
                return d;
            });
        } else {
            updatedDeclarations = [
                ...declarations,
                {
                    period,
                    type: obType as TaxObligationType,
                    status: DeclarationStatus.Enviada,
                    isNotifiedWhatsApp: true,
                    notifiedWhatsAppAt: nowIso,
                    updatedAt: nowIso
                }
            ];
        }

        useAppStore.getState().updateClient(client.id, { declarations: updatedDeclarations });

        if (activeCellModal && activeCellModal.client.id === client.id) {
            const updatedDecl = updatedDeclarations.find(d => findDeclarationForOb([d], period, obType));
            if (updatedDecl) {
                setActiveCellModal({
                    ...activeCellModal,
                    client: { ...client, declarations: updatedDeclarations },
                    declaration: updatedDecl
                });
            }
        }

        if (newNotifiedStatus) {
            toast.success(`Declaración de ${client.tradeName || client.name} marcada como NOTIFICADA`);
        } else {
            toast.info(`Declaración de ${client.tradeName || client.name} marcada como PENDIENTE de notificar`);
        }
    };

    const [postUploadModal, setPostUploadModal] = useState<{
        client: Client;
        period: string;
        obType: TaxObligationType;
        declaration: Declaration;
    } | null>(null);

    // Enviar WhatsApp directo con Saludo Automático por Horario y Mensajería Dinámica por Etapa (1: Envío Comprobante, 2: Recordatorio Cobro, 3+: Seguimiento)
    const handleSendWhatsAppNotification = (client: Client, period: string, obType: string, decl?: Declaration) => {
        const phone = (client.phones && client.phones.length > 0 && client.phones[0]) ? client.phones[0] : '';
        const greeting = getTimeBasedGreeting();
        const clientName = client.tradeName || client.name;
        const displayPeriod = formatPeriodForDisplay(period);
        const currentCount = decl?.notificationCount || 0;
        const isPaid = decl?.status === DeclarationStatus.Pagada || !!decl?.is_paid || client.isCourtesy;

        const fee = client.fee_structure?.monthly || client.customServiceFee || 15;

        let messageText = '';
        if (currentCount === 0 || !decl?.isNotifiedWhatsApp) {
            // ETAPA 1: Notificación Inicial (Envío de Comprobante)
            messageText = `${greeting} Estimado/a ${clientName}, le confirmo que su declaración de ${obType} correspondiente al período ${displayPeriod} ha sido realizada y procesada exitosamente en el SRI. Le adjunto el comprobante oficial. Saludos cordiales, Soluciones Contables Pro.`;
        } else if (!isPaid && currentCount === 1) {
            // ETAPA 2: Primer Recordatorio de Pago / Cobro
            messageText = `${greeting} Estimado/a ${clientName}, le recordamos amablemente que mantenemos pendiente el pago de honorarios por su declaración de ${obType} (${displayPeriod}) por un valor de $${fee}. Quedamos atentos a su comprobante de transferencia. Saludos, Soluciones Contables Pro.`;
        } else {
            // ETAPA 3+: Seguimiento Insistente de Pago
            messageText = `${greeting} Estimado/a ${clientName}, nos comunicamos para darle seguimiento al saldo pendiente de $${fee} por su declaración de ${obType} (${displayPeriod}). Le agradecemos enormemente su colaboración enviándonos el comprobante de transferencia a la brevedad posible. Saludos, Soluciones Contables Pro.`;
        }
        
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('09')) cleanPhone = '593' + cleanPhone.substring(1);
        if (!cleanPhone.startsWith('593') && cleanPhone.length === 9) cleanPhone = '593' + cleanPhone;

        const whatsappUrl = cleanPhone 
            ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
            : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

        window.open(whatsappUrl, '_blank');

        // Actualizar el estado de notificación e incrementar el contador de notificaciones
        const declarations = client.declarations || [];
        const existingDecl = findDeclarationForOb(declarations, period, obType);
        const nowIso = new Date().toISOString();
        const nextCount = currentCount + 1;

        let updatedDeclarations: Declaration[];
        if (existingDecl) {
            updatedDeclarations = declarations.map(d => {
                const matchPeriod = arePeriodsEqual(d.period, period) || d.period === period;
                const matchType = d.type === obType || (!d.type && (obType === 'IVA' || obType === 'RENTA'));
                if (matchPeriod && matchType) {
                    return {
                        ...d,
                        isNotifiedWhatsApp: true,
                        notifiedWhatsAppAt: nowIso,
                        notificationCount: nextCount,
                        updatedAt: nowIso
                    };
                }
                return d;
            });
        } else {
            updatedDeclarations = [
                ...declarations,
                {
                    period,
                    type: obType as TaxObligationType,
                    status: DeclarationStatus.Enviada,
                    isNotifiedWhatsApp: true,
                    notifiedWhatsAppAt: nowIso,
                    notificationCount: 1,
                    updatedAt: nowIso
                }
            ];
        }

        useAppStore.getState().updateClient(client.id, { declarations: updatedDeclarations });

        if (activeCellModal && activeCellModal.client.id === client.id) {
            const updatedDecl = updatedDeclarations.find(d => findDeclarationForOb([d], period, obType));
            if (updatedDecl) {
                setActiveCellModal({
                    ...activeCellModal,
                    client: { ...client, declarations: updatedDeclarations },
                    declaration: updatedDecl
                });
            }
        }

        toast.success(`Notificación Etapa ${nextCount} enviada a ${clientName}`);
    };

    // Sync mode when navigating between matrix/renta tabs
    React.useEffect(() => {
        setMatrixMode(initialMode);
    }, [initialMode]);

    const handleCopyRuc = (ruc: string, clientName: string) => {
        navigator.clipboard.writeText(ruc).then(() => {
            setCopiedRuc(ruc);
            toast.success(`RUC de ${clientName} copiado al portapapeles`);
            setTimeout(() => setCopiedRuc(null), 2000);
        }).catch(() => {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = ruc;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopiedRuc(ruc);
            toast.success(`RUC de ${clientName} copiado`);
            setTimeout(() => setCopiedRuc(null), 2000);
        });
    };

    const handleCopyKey = (password: string, clientId: string, clientName: string) => {
        navigator.clipboard.writeText(password).then(() => {
            setCopiedKey(clientId);
            toast.success(`Clave SRI de ${clientName} copiada`);
            setTimeout(() => setCopiedKey(null), 2000);
        }).catch(() => {
            setCopiedKey(clientId);
            setTimeout(() => setCopiedKey(null), 2000);
        });
    };

    const today = new Date();

    // Generar periodos a mostrar
    const periods = useMemo(() => {
        const result: string[] = [];
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // 1-12

        if (matrixMode === 'RENTA') {
            // Renta: mostrar 3 años fiscales (año anterior, anteanterior, uno más atrás)
            for (let i = 1; i <= 3; i++) {
                result.push((currentYear - i).toString());
            }
            return result;
        }

        if (frequency === 'Mensual') {
            // El mensual solo habilita hasta el mes anterior
            let maxMonth: number;
            if (selectedYear === currentYear) {
                maxMonth = currentMonth - 1;
                if (maxMonth < 1) maxMonth = 0; // Enero: sin meses del año actual
            } else {
                maxMonth = 12;
            }
            for (let m = maxMonth; m >= 1; m--) {
                const monthStr = m < 10 ? `0${m}` : `${m}`;
                result.push(`${selectedYear}-${monthStr}`);
            }
        } else if (frequency === 'Semestral') {
            // Mostrar 3 semestres hacia atrás desde el actual
            const currentSemester = currentMonth <= 6 ? 1 : 2;

            const semList: string[] = [];
            let yr = currentYear;
            let sem = currentSemester;

            const totalNeeded = 3;
            while (semList.length < totalNeeded) {
                sem -= 1;
                if (sem < 1) { sem = 2; yr -= 1; }
                semList.push(`${yr}-S${sem}`);
            }

            const s1Enabled = currentSemester === 1 && currentMonth >= 6;
            const s2Enabled = currentSemester === 2 && currentMonth >= 12;
            if (s1Enabled || s2Enabled) {
                result.push(`${currentYear}-S${currentSemester}`);
            }
            result.push(...semList);
        }
        return result;
    }, [frequency, matrixMode, selectedYear, today]);

    const findDeclarationForOb = (clientDeclarations: Declaration[], period: string, obType: string) => {
        return clientDeclarations.find(dh => {
            let targetPeriod = period;
            if (obType === 'ICE') {
                targetPeriod = `${period}:ICE`;
            } else if (obType === 'ANEXO') {
                if (matrixMode === 'RENTA') {
                    targetPeriod = `${period}:GAP`;
                } else {
                    targetPeriod = `${period}:ANEXO_ICE`;
                }
            } else if (obType === 'PVP') {
                targetPeriod = `${period}:PVP`;
            } else if (obType === 'DEVOLUCION') {
                targetPeriod = `${period}:DEV`;
            }
            const matchPeriod = dh.period === targetPeriod || dh.period === period || arePeriodsEqual(dh.period, targetPeriod) || arePeriodsEqual(dh.period, period) || dh.period === targetPeriod.replace(':', '-');
            const matchType = dh.type === obType || (!dh.type && (obType === 'IVA' || obType === 'RENTA'));
            return matchPeriod && matchType;
        });
    };

    // Check if client has uploaded all proofs for the displayed matrix periods
    const isClientCompletedForPeriod = (client: Client, p: string) => {
        if (isPeriodBeforeClientStart(client, p)) return true;
        const obligations = getObligationsForPeriod(client, p);
        if (obligations.length === 0) return true;
        const declarations = client.declarations || [];
        return obligations.every(ob => {
            const d = findDeclarationForOb(declarations, p, ob.type);
            return d && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada || !!d.proof_file) && d.proof_file;
        });
    };

    const isClientUpToDate = (client: Client) => {
        return periods.every(p => isClientCompletedForPeriod(client, p));
    };

    const handleSortByPeriod = (p: string) => {
        if (sortPeriod === p) {
            if (sortDirection === 'missing_first') {
                setSortDirection('completed_first');
            } else if (sortDirection === 'completed_first') {
                setSortPeriod(null);
                setSortDirection(null);
            }
        } else {
            setSortPeriod(p);
            setSortDirection('missing_first');
        }
    };

    const filteredClients = useMemo(() => {
        const hasPriorityDeclaration = (c: Client) => {
            return (c.declarations || []).some(d => d.isPriority && d.status === DeclarationStatus.Pendiente);
        };

        return clients.filter(c => {
            if (c.requiresDeclarations === false || c.clientType === 'solo_plan') {
                return false;
            }

            if (selectedDigitFilter !== null) {
                const digit = getNinthDigit(c.ruc);
                if (digit !== selectedDigitFilter) return false;
            }

            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase().trim();
                const matchName = c.name.toLowerCase().includes(q) || (c.tradeName && c.tradeName.toLowerCase().includes(q));
                const matchRuc = c.ruc.includes(q);
                if (!matchName && !matchRuc) return false;
            }

            const clientFreq = c.taxProfile?.ivaFrequency ||
                (c.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' :
                 c.regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual');

            const isActive = !c.isDeleted && c.isActive;

            if (matrixMode === 'RENTA') {
                const hasRenta = c.taxProfile?.requiresAnnualRenta ||
                    c.regime === TaxRegime.RimpeEmprendedor ||
                    c.regime === TaxRegime.RimpeNegocioPopular ||
                    c.regime === TaxRegime.General;
                return isActive && hasRenta;
            }

            if (searchTerm.trim() && matrixMode === 'IVA') {
                return isActive && (clientFreq === 'Mensual' || clientFreq === 'Semestral');
            }

            return isActive && clientFreq === frequency;
        }).sort((a, b) => {
            const priorityA = hasPriorityDeclaration(a);
            const priorityB = hasPriorityDeclaration(b);
            if (priorityA !== priorityB) {
                return priorityA ? -1 : 1;
            }

            // Group by Frequency when searching
            if (searchTerm.trim() && matrixMode === 'IVA') {
                const getFreqWeight = (c: Client) => {
                    const freq = c.taxProfile?.ivaFrequency || (c.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' : c.regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual');
                    return freq === 'Mensual' ? 1 : freq === 'Semestral' ? 2 : 3;
                };
                const fwA = getFreqWeight(a);
                const fwB = getFreqWeight(b);
                if (fwA !== fwB) return fwA - fwB;
            }

            // Custom Period Sorting
            if (sortPeriod && sortDirection) {
                const isCompletedA = isClientCompletedForPeriod(a, sortPeriod);
                const isCompletedB = isClientCompletedForPeriod(b, sortPeriod);
                
                if (isCompletedA !== isCompletedB) {
                    if (sortDirection === 'missing_first') {
                        return isCompletedA ? 1 : -1;
                    } else {
                        return isCompletedA ? -1 : 1;
                    }
                }
            }

            if (isWorkspaceMode) {
                const upToDateA = isClientUpToDate(a);
                const upToDateB = isClientUpToDate(b);
                if (upToDateA !== upToDateB) {
                    return upToDateA ? 1 : -1;
                }
            }

            // Ordenamiento por Semáforo / Color del Cliente (Naranja, Rojo, Verde)
            if (sortOption.startsWith('color_')) {
                const getWeight = (c: Client) => {
                    const comp = getClientCompliance(c, today, (frequency === 'Ninguno' ? 'all' : frequency) as any);
                    const color = comp.overallColor;
                    if (sortOption === 'color_orange') {
                        if (color === 'orange') return 1;
                        if (color === 'red') return 2;
                        if (color === 'yellow') return 3;
                        if (color === 'green') return 4;
                        return 5;
                    }
                    if (sortOption === 'color_red') {
                        if (color === 'red') return 1;
                        if (color === 'orange') return 2;
                        if (color === 'yellow') return 3;
                        if (color === 'green') return 4;
                        return 5;
                    }
                    if (sortOption === 'color_green') {
                        if (color === 'green') return 1;
                        if (color === 'orange') return 2;
                        if (color === 'yellow') return 3;
                        if (color === 'red') return 4;
                        return 5;
                    }
                    if (sortOption === 'color_priority') {
                        const prio: Record<string, number> = { red: 1, orange: 2, yellow: 3, green: 4, gray: 5 };
                        return prio[color] || 5;
                    }
                    return 5;
                };

                const weightA = getWeight(a);
                const weightB = getWeight(b);
                if (weightA !== weightB) {
                    return weightA - weightB;
                }
            }

            if (sortOption === 'alphabetical') {
                const nameA = a.tradeName || a.name;
                const nameB = b.tradeName || b.name;
                return nameA.localeCompare(nameB);
            }

            const digitA = parseInt(a.ruc[8], 10) === 0 ? 10 : parseInt(a.ruc[8], 10);
            const digitB = parseInt(b.ruc[8], 10) === 0 ? 10 : parseInt(b.ruc[8], 10);
            return digitA - digitB || (a.tradeName || a.name).localeCompare(b.tradeName || b.name);
        });
    }, [clients, frequency, matrixMode, isWorkspaceMode, periods, sortPeriod, sortDirection, selectedDigitFilter, sortOption, searchTerm]);

    // ── SUPER DOCK DE COMPROBANTES MASIVOS & SELECCIÓN ──
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const isAllSelected = filteredClients.length > 0 && selectedClientIds.length === filteredClients.length;

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedClientIds([]);
        } else {
            setSelectedClientIds(filteredClients.map(c => c.id));
        }
    };

    const handleToggleSelectClient = (clientId: string) => {
        setSelectedClientIds(prev =>
            prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
        );
    };

    const handleBulkPrint = () => {
        const selectedClientsList = clients.filter(c => selectedClientIds.includes(c.id));
        if (selectedClientsList.length === 0) {
            toast.info("Seleccione al menos un cliente para imprimir.");
            return;
        }

        const proofList: { clientName: string; ruc: string; period: string; url?: string; hasPdf: boolean }[] = [];
        const activePeriod = periods[0] || '';
        const mainObType = matrixMode === 'RENTA' ? 'RENTA' : 'IVA';

        selectedClientsList.forEach(client => {
            const decls = client.declarations || [];
            const d = findDeclarationForOb(decls, activePeriod, mainObType);
            if (d?.proof_file) {
                proofList.push({
                    clientName: client.tradeName || client.name,
                    ruc: client.ruc,
                    period: d.period || activePeriod,
                    url: d.proof_file.url || undefined,
                    hasPdf: true
                });
            }
        });

        if (proofList.length === 0) {
            toast.warning("Ninguno de los clientes seleccionados posee un archivo PDF de comprobante en el periodo seleccionado.");
            return;
        }

        const printWin = window.open('', '_blank');
        if (!printWin) {
            toast.error("Por favor, permita las ventanas emergentes en su navegador.");
            return;
        }

        printWin.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <title>Lote_Impresion_Comprobantes_SRI</title>
                <meta charset="utf-8" />
                <style>
                    body { font-family: 'Inter', system-ui, sans-serif; background: #0f172a; color: white; margin: 0; padding: 24px; }
                    .header { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 16px 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 24px; }
                    .title { font-size: 18px; font-weight: 900; }
                    .subtitle { font-size: 11px; color: #94a3b8; margin-top: 2px; }
                    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px; }
                    .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; }
                    .client-name { font-size: 14px; font-weight: 800; color: #38bdf8; }
                    .meta { font-size: 11px; color: #94a3b8; margin-top: 4px; font-family: monospace; }
                    .btn { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-size: 11px; font-weight: 800; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; }
                    .btn-green { background: #10b981; }
                    iframe { width: 100%; height: 320px; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; margin: 12px 0; background: #fff; }
                    @media print { .no-print { display: none !important; } }
                </style>
            </head>
            <body>
                <div class="header no-print">
                    <div>
                        <div class="title">🖨️ Lote de Impresión - Comprobantes SRI</div>
                        <div class="subtitle">${proofList.length} Comprobantes Listos de Supabase Storage</div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.print()" class="btn btn-green">🖨️ Imprimir Todo</button>
                        <button onclick="window.close()" class="btn" style="background:#475569;">Cerrar</button>
                    </div>
                </div>
                <div class="grid">
                    ${proofList.map(item => `
                        <div class="card">
                            <div>
                                <div class="client-name">${item.clientName}</div>
                                <div class="meta">RUC: ${item.ruc} | Periodo: ${item.period}</div>
                                ${item.url ? `<iframe src="${item.url}"></iframe>` : '<div style="padding:15px; background:#0f172a; border-radius:8px; font-size:11px; text-align:center;">Comprobante registrado sin URL directa de Storage</div>'}
                            </div>
                            ${item.url ? `<a href="${item.url}" target="_blank" class="btn">Abrir PDF Original</a>` : ''}
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
        `);

        toast.success(`Abriendo lote de ${proofList.length} comprobantes para impresión.`);
    };

    const handleBulkDownload = async () => {
        const selectedClientsList = clients.filter(c => selectedClientIds.includes(c.id));
        if (selectedClientsList.length === 0) {
            toast.info("Seleccione al menos un cliente.");
            return;
        }

        const activePeriod = periods[0] || '';
        const mainObType = matrixMode === 'RENTA' ? 'RENTA' : 'IVA';
        let count = 0;

        for (const client of selectedClientsList) {
            const decls = client.declarations || [];
            const d = findDeclarationForOb(decls, activePeriod, mainObType);
            if (d?.proof_file) {
                const fileName = `Declaracion_${mainObType}_${client.ruc}_${d.period || activePeriod}.pdf`;
                const ok = await downloadStoredFile(d.proof_file, fileName);
                if (ok) count++;
            }
        }

        if (count > 0) {
            toast.success(`📥 ${count} comprobantes descargados correctamente.`);
        } else {
            toast.warning("No se encontraron archivos PDF de comprobantes en los clientes seleccionados para este periodo.");
        }
    };

    const handleBulkMarkNotified = async () => {
        const selectedClientsList = clients.filter(c => selectedClientIds.includes(c.id));
        if (selectedClientsList.length === 0) {
            toast.info("Seleccione al menos un cliente.");
            return;
        }

        const activePeriod = periods[0] || '';
        const mainObType = matrixMode === 'RENTA' ? 'RENTA' : 'IVA';
        const nowIso = new Date().toISOString();

        for (const client of selectedClientsList) {
            const decls = client.declarations || [];
            const existingDecl = findDeclarationForOb(decls, activePeriod, mainObType);

            let updatedDecls: Declaration[];
            if (existingDecl) {
                updatedDecls = decls.map(d => {
                    if (arePeriodsEqual(d.period, activePeriod) && (d.type === mainObType || !d.type)) {
                        return {
                            ...d,
                            isNotifiedWhatsApp: true,
                            notifiedWhatsAppAt: nowIso,
                            notificationCount: (d.notificationCount || 0) + 1,
                            updatedAt: nowIso
                        };
                    }
                    return d;
                });
            } else {
                updatedDecls = [
                    ...decls,
                    {
                        period: activePeriod,
                        type: mainObType as TaxObligationType,
                        status: DeclarationStatus.Enviada,
                        isNotifiedWhatsApp: true,
                        notifiedWhatsAppAt: nowIso,
                        notificationCount: 1,
                        updatedAt: nowIso
                    }
                ];
            }
            await useAppStore.getState().updateClient(client.id, { declarations: updatedDecls });
        }

        toast.success(`✅ ${selectedClientsList.length} clientes marcados como NOTIFICADOS.`);
    };

    const handleBulkWhatsAppNotify = () => {
        const selectedClientsList = clients.filter(c => selectedClientIds.includes(c.id));
        if (selectedClientsList.length === 0) {
            toast.info("Seleccione al menos un cliente.");
            return;
        }

        const activePeriod = periods[0] || '';
        const mainObType = matrixMode === 'RENTA' ? 'RENTA' : 'IVA';

        let count = 0;
        selectedClientsList.forEach(client => {
            const decls = client.declarations || [];
            const d = findDeclarationForOb(decls, activePeriod, mainObType);
            if (d?.proof_file) {
                handleSendWhatsAppNotification(client, activePeriod, mainObType, d);
                count++;
            }
        });

        if (count === 0) {
            toast.warning("Ninguno de los clientes seleccionados tiene comprobante PDF listo para notificar.");
        }
    };

    const totalFiltered = filteredClients.length;
    const activePeriodForKpi = periods[0] || '';
    const mainObTypeForKpi = matrixMode === 'RENTA' ? 'RENTA' : 'IVA';

    const compliantClientsCount = useMemo(() => {
        return filteredClients.filter(c => isClientUpToDate(c)).length;
    }, [filteredClients, periods]);

    const complianceRate = totalFiltered > 0 ? Math.round((compliantClientsCount / totalFiltered) * 100) : 100;

    const pendingDeclarationsCount = useMemo(() => {
        return filteredClients.filter(c => !isClientCompletedForPeriod(c, activePeriodForKpi)).length;
    }, [filteredClients, activePeriodForKpi]);

    const cloudStoredPdfsCount = useMemo(() => {
        let count = 0;
        filteredClients.forEach(c => {
            (c.declarations || []).forEach(d => {
                if (d.proof_file && (d.proof_file.url || d.proof_file.name)) count++;
            });
        });
        return count;
    }, [filteredClients]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Executive Stitch Glassmorphic KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Clientes */}
                <div className="bg-[#051424]/90 backdrop-blur-2xl border border-white/10 border-t-white/20 rounded-3xl p-5 relative overflow-hidden group hover:border-[#2B6AFF]/40 transition-all shadow-2xl">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-[#2B6AFF]/10 rounded-full blur-2xl group-hover:bg-[#2B6AFF]/20 transition-all" />
                    <div className="flex justify-between items-start relative z-10">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Total Clientes</span>
                        <div className="p-2.5 rounded-2xl bg-[#2B6AFF]/15 border border-[#2B6AFF]/30 text-[#2B6AFF] shadow-sm">
                            <LucideIcons.Users size={16} />
                        </div>
                    </div>
                    <div className="mt-3 relative z-10 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white font-mono">{totalFiltered}</span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                            {matrixMode === 'RENTA' ? 'Renta Activa' : frequency}
                        </span>
                    </div>
                    <div className="mt-2 text-[10px] font-medium text-slate-400/90 flex items-center gap-1.5 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A896] shadow-[0_0_8px_rgba(0,168,150,0.8)]" />
                        <span>Portafolio fiscal en seguimiento</span>
                    </div>
                </div>

                {/* Card 2: % Al Día */}
                <div className="bg-[#051424]/90 backdrop-blur-2xl border border-white/10 border-t-white/20 rounded-3xl p-5 relative overflow-hidden group hover:border-[#00A896]/40 transition-all shadow-2xl">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-[#00A896]/10 rounded-full blur-2xl group-hover:bg-[#00A896]/20 transition-all" />
                    <div className="flex justify-between items-start relative z-10">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#00A896] font-mono">% Cumplimiento SRI</span>
                        <div className="p-2.5 rounded-2xl bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] shadow-sm">
                            <LucideIcons.ShieldCheck size={16} />
                        </div>
                    </div>
                    <div className="mt-3 relative z-10 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-[#00A896] font-mono">{complianceRate}%</span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">({compliantClientsCount} al día)</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5">
                        <div 
                            className="bg-gradient-to-r from-[#00A896] to-teal-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,168,150,0.4)]" 
                            style={{ width: `${complianceRate}%` }} 
                        />
                    </div>
                </div>

                {/* Card 3: Pendientes del Periodo */}
                <div className={`bg-[#051424]/90 backdrop-blur-2xl border rounded-3xl p-5 relative overflow-hidden group transition-all shadow-2xl ${
                    pendingDeclarationsCount > 0 
                        ? 'border-amber-500/40 hover:border-amber-500/60' 
                        : 'border-white/10 border-t-white/20 hover:border-[#00A896]/40'
                }`}>
                    <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                    <div className="flex justify-between items-start relative z-10">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 font-mono">Pendientes {activePeriodForKpi}</span>
                        <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm">
                            <LucideIcons.Clock size={16} />
                        </div>
                    </div>
                    <div className="mt-3 relative z-10 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-amber-400 font-mono">{pendingDeclarationsCount}</span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">por declarar</span>
                    </div>
                    <div className="mt-2 text-[10px] font-semibold text-amber-400/90 flex items-center gap-1.5 font-mono">
                        {pendingDeclarationsCount > 0 ? (
                            <>
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                <span>Requiere acción en SRI</span>
                            </>
                        ) : (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#00A896]" />
                                <span>Periodo completamente al día</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Card 4: Cloud Storage Sync (R2 / Supabase) */}
                <div className="bg-[#051424]/90 backdrop-blur-2xl border border-white/10 border-t-white/20 rounded-3xl p-5 relative overflow-hidden group hover:border-sky-500/40 transition-all shadow-2xl flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all" />
                    <div>
                        <div className="flex justify-between items-start relative z-10">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400 font-mono">Bóveda Nube R2</span>
                            <div className="p-2.5 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 shadow-sm">
                                <LucideIcons.UploadCloud size={16} />
                            </div>
                        </div>
                        <div className="mt-3 relative z-10 flex items-baseline gap-2">
                            <span className="text-3xl font-black text-sky-400 font-mono">{cloudStoredPdfsCount}</span>
                            <span className="text-[10px] font-bold text-slate-400 font-mono">PDFs Respaldados</span>
                        </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between font-mono">
                        <span className="text-[9px] text-[#00A896] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00A896] shadow-[0_0_6px_rgba(0,168,150,0.8)]" />
                            $0 Egress Cloudflare
                        </span>
                        <button
                            onClick={handleOptimizeSupabaseStorage}
                            disabled={isOptimizingStorage}
                            className="text-[9px] font-bold uppercase tracking-wider text-sky-300 hover:text-white bg-sky-500/20 hover:bg-sky-500/30 px-2.5 py-1 rounded-xl border border-sky-500/30 transition-all flex items-center gap-1 cursor-pointer"
                            title="Optimizar almacenamiento y migrar Base64 restante a la nube"
                        >
                            <LucideIcons.Sparkles size={10} />
                            <span>{isOptimizingStorage ? '...' : 'Optimizar'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 🎯 RUC 9th DIGIT QUICK JUMP STRIP (Calendario Oficial SRI) */}
            <div className="flex items-center gap-2 p-3 bg-[#051424]/90 backdrop-blur-2xl rounded-[2rem] border border-white/10 border-t-white/20 overflow-x-auto no-scrollbar font-mono text-xs shadow-xl no-print">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-bold uppercase tracking-wider shrink-0 text-[10px]">
                    <LucideIcons.CalendarClock size={14} className="text-[#00A896]" />
                    <span>Dígito RUC:</span>
                </div>

                <button
                    onClick={() => setSelectedDigitFilter(null)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                        selectedDigitFilter === null
                            ? 'bg-gradient-to-r from-[#00A896] to-teal-600 text-white shadow-md shadow-[#00A896]/30 font-black border border-white/20 scale-[1.02]'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                    }`}
                >
                    <LucideIcons.Layers size={12} />
                    <span>Todos</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-black/20 text-white font-mono">
                        {clients.filter(c => c.requiresDeclarations !== false && c.clientType !== 'solo_plan' && (!c.isDeleted && c.isActive)).length}
                    </span>
                </button>

                {[
                    { digit: 1, day: 10 },
                    { digit: 2, day: 12 },
                    { digit: 3, day: 14 },
                    { digit: 4, day: 16 },
                    { digit: 5, day: 18 },
                    { digit: 6, day: 20 },
                    { digit: 7, day: 22 },
                    { digit: 8, day: 24 },
                    { digit: 9, day: 26 },
                    { digit: 0, day: 28 },
                ].map(({ digit, day }) => {
                    const count = clients.filter(c => 
                        c.requiresDeclarations !== false && 
                        c.clientType !== 'solo_plan' && 
                        !c.isDeleted && 
                        c.isActive && 
                        parseInt(c.ruc[8], 10) === digit
                    ).length;

                    const isSelected = selectedDigitFilter === digit;

                    return (
                        <button
                            key={digit}
                            onClick={() => setSelectedDigitFilter(isSelected ? null : digit)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                isSelected
                                    ? 'bg-gradient-to-r from-[#2B6AFF] to-indigo-600 text-white shadow-lg shadow-[#2B6AFF]/30 font-black scale-105 border border-white/20'
                                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                            }`}
                            title={`Filtrar contribuyentes con 9no dígito ${digit} — Vencimiento SRI: Día ${day} de cada mes`}
                        >
                            <span>Díg. <strong className="text-white font-black">{digit}</strong></span>
                            <span className="text-[8px] opacity-70">({day}d)</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                                isSelected ? 'bg-white/20 text-white font-black' : 'bg-black/20 text-slate-400'
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Header / Controls (Stitch Nueva Luz 3.0) */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-2xl relative overflow-hidden transition-all duration-500 font-sans">
                <div className="flex items-center gap-4">
                    <div className={`p-4 text-white rounded-2xl shadow-lg border border-white/10 ${
                        matrixMode === 'RENTA' 
                            ? 'bg-gradient-to-br from-amber-400 to-[#C9A96E] shadow-amber-400/25' 
                            : 'bg-gradient-to-br from-[#00A896] to-teal-600 shadow-[#00A896]/30'
                    }`}>
                        {matrixMode === 'RENTA' ? <LucideIcons.Award size={22} /> : <LucideIcons.LayoutGrid size={22} />}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight font-display">
                            {matrixMode === 'RENTA' ? 'MATRIZ DE RENTA ANUAL' : 'MATRIZ FISCAL Y OBLIGACIONES'}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">
                            {matrixMode === 'RENTA' ? 'Impuesto a la Renta · Historial Fiscal SRI' : 'Control Integral de Respaldos y Declaraciones SRI'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto font-mono">
                    {/* Buscador Directo en Matriz */}
                    <div className="relative flex-1 min-w-[220px] sm:min-w-[280px]">
                        <LucideIcons.Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="🔍 Buscar cliente o RUC..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-xs font-medium text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00A896] transition-all font-mono shadow-inner"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/10 hover:bg-rose-500 hover:text-white text-slate-400 transition-all"
                                title="Limpiar filtro"
                            >
                                <LucideIcons.X size={10} strokeWidth={3} />
                            </button>
                        )}
                    </div>

                    {/* Botones Bucle RPA: Llenar vs Recuperar PDFs */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const type = matrixMode === 'IVA' ? (frequency === 'Mensual' ? 'mensual' : 'semestral') : 'renta';
                                sendBatchDeclarationToExtension(filteredClients, type, 'declare');
                                toast.info(`Iniciando Bucle Automático 🚀 Se han enviado ${filteredClients.length} clientes a la extensión para declaración en bucle.`);
                            }}
                            className="px-4 py-2.5 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 shadow-lg shadow-[#00A896]/20 cursor-pointer border border-white/10 active:scale-95"
                            title="Iniciar automatización completa (Auditar, Llenar formulario y Declarar)"
                        >
                            <LucideIcons.Play size={13} fill="currentColor" />
                            <span>Declarar & Llenar</span>
                        </button>

                        <button
                            onClick={() => {
                                const type = matrixMode === 'IVA' ? (frequency === 'Mensual' ? 'mensual' : 'semestral') : 'renta';
                                sendBatchDeclarationToExtension(filteredClients, type, 'recover_pdf_only');
                                toast.info(`Iniciando Búsqueda de Comprobantes 🔍 Se han enviado ${filteredClients.length} clientes a la extensión para buscar únicamente PDFs faltantes.`);
                            }}
                            className="px-4 py-2.5 bg-gradient-to-r from-[#2B6AFF] to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 shadow-lg shadow-[#2B6AFF]/20 cursor-pointer border border-white/10 active:scale-95"
                            title="Desacoplado: Ir directo a buscar y descargar PDFs de comprobantes emitidos sin llenar formularios"
                        >
                            <LucideIcons.Search size={13} />
                            <span>🔍 Solo PDFs</span>
                        </button>
                    </div>

                    {/* Selector de Densidad (Compacto vs Detallado) */}
                    <div className="flex items-center p-1 bg-[#020b14]/60 rounded-2xl border border-white/10">
                        <button
                            onClick={() => handleToggleDensity('compact')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                densityMode === 'compact'
                                    ? 'bg-[#00A896] text-white shadow-md shadow-[#00A896]/30 font-black'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                            title="Vista compacta de alta densidad (15+ clientes por pantalla)"
                        >
                            <LucideIcons.LayoutList size={12} />
                            <span>Compacto</span>
                        </button>
                        <button
                            onClick={() => handleToggleDensity('detailed')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                densityMode === 'detailed'
                                    ? 'bg-[#00A896] text-white shadow-md shadow-[#00A896]/30 font-black'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                            title="Vista detallada con tarjetas expandidas"
                        >
                            <LucideIcons.LayoutGrid size={12} />
                            <span>Detallado</span>
                        </button>
                    </div>

                    {/* Control de Ordenamiento: Dígito vs Semáforo de Colores vs Alfabético */}
                    <div className="flex flex-wrap items-center gap-1 bg-[#020b14]/60 p-1.5 rounded-2xl border border-white/10">
                        <button
                            onClick={() => setSortOption('9th_digit')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 ${
                                sortOption === '9th_digit'
                                    ? 'bg-[#00A896] text-white shadow-md shadow-[#00A896]/30 scale-[1.02] border border-white/10'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                            title="Ordenar por Dígito RUC (Calendario SRI)"
                        >
                            <LucideIcons.Binary size={12} />
                            <span>Dígito</span>
                        </button>

                        <button
                            onClick={() => setSortOption('color_orange')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 border ${
                                sortOption === 'color_orange'
                                    ? 'bg-orange-500 text-white border-orange-600 shadow-md shadow-orange-500/20 scale-[1.02]'
                                    : 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20'
                            }`}
                            title="Ver Naranjas Primero (Declarado, Falta Cancelar/Cobrar)"
                        >
                            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                            <span>Naranjas</span>
                        </button>

                        <button
                            onClick={() => setSortOption('color_red')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 border ${
                                sortOption === 'color_red'
                                    ? 'bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-500/20 scale-[1.02]'
                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                            }`}
                            title="Ver Rojos Primero (Vencidos / Urgentes)"
                        >
                            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                            <span>Rojos</span>
                        </button>

                        <button
                            onClick={() => setSortOption('color_green')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 border ${
                                sortOption === 'color_green'
                                    ? 'bg-[#00A896] text-white border-[#00A896] shadow-md shadow-[#00A896]/20 scale-[1.02]'
                                    : 'bg-[#00A896]/10 border-[#00A896]/20 text-[#00A896] hover:bg-[#00A896]/20'
                            }`}
                            title="Ver Verdes Primero (Al Día y Pagados)"
                        >
                            <span className="w-2 h-2 rounded-full bg-[#00A896]" />
                            <span>Verdes</span>
                        </button>

                        <button
                            onClick={() => setSortOption('alphabetical')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 ${
                                sortOption === 'alphabetical'
                                    ? 'bg-[#00A896] text-white shadow-md shadow-[#00A896]/20 scale-[1.02] border border-white/10'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                            title="Ordenar por Nombre Alfabético (A - Z)"
                        >
                            <LucideIcons.SortAsc size={12} />
                            <span>A-Z</span>
                        </button>
                    </div>

                    {/* Integrated Segmented Control for Mode/Frequency */}
                    <div className="flex items-center gap-1.5 bg-[#020b14]/60 p-1.5 rounded-2xl border border-white/10">
                        {[
                            { id: 'iva-mensual', label: 'IVA Mensual', mode: 'IVA' as MatrixMode, freq: 'Mensual' as IvaFrequency, icon: LucideIcons.Calendar },
                            { id: 'iva-semestral', label: 'IVA Semestral', mode: 'IVA' as MatrixMode, freq: 'Semestral' as IvaFrequency, icon: LucideIcons.CalendarRange },
                            { id: 'renta-anual', label: 'Renta Anual', mode: 'RENTA' as MatrixMode, freq: 'Ninguno' as IvaFrequency, icon: LucideIcons.Award }
                        ].map(tab => {
                            const isActive = matrixMode === tab.mode && (tab.mode === 'RENTA' || frequency === tab.freq);
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setMatrixMode(tab.mode);
                                        if (tab.mode === 'IVA') {
                                            setFrequency(tab.freq);
                                        }
                                    }}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono transition-all duration-300 flex items-center gap-2 ${
                                        isActive 
                                            ? 'bg-gradient-to-r from-[#00A896] to-teal-600 text-white shadow-md shadow-[#00A896]/30 scale-[1.02] border border-white/10' 
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <tab.icon size={12} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Year Selector */}
                    {matrixMode === 'IVA' && frequency === 'Mensual' && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                            className="bg-[#0b1326]/80 text-white text-[10px] font-bold font-mono uppercase tracking-wider px-3.5 py-2.5 rounded-2xl border border-white/10 outline-none cursor-pointer hover:border-white/20 transition-all shadow-sm"
                        >
                            {[today.getFullYear(), today.getFullYear() - 1].map(y => (
                                <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
                            ))}
                        </select>
                    )}

                    {/* Workspace desk switcher */}
                    <button
                        onClick={() => setIsWorkspaceMode(!isWorkspaceMode)}
                        className={`px-4 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-wider font-mono transition-all flex items-center gap-2 border shadow-sm active:scale-95 ${
                            isWorkspaceMode 
                                ? 'bg-gradient-to-r from-[#00A896] to-teal-500 text-white border-[#00A896]/50 shadow-[#00A896]/20' 
                                : 'bg-[#0b1326]/80 text-slate-400 border-white/10 hover:text-white hover:border-white/20'
                        }`}
                        title="Priorizar clientes con obligaciones pendientes"
                    >
                        <LucideIcons.Briefcase size={12} />
                        <span>{isWorkspaceMode ? 'Pendientes Primero' : 'Orden Dígito'}</span>
                    </button>

                    <button 
                        onClick={() => window.print()}
                        className="p-2.5 bg-[#0b1326]/80 text-slate-400 hover:text-white rounded-2xl border border-white/10 hover:border-white/20 transition-all no-print shadow-sm"
                        title="Imprimir Reporte"
                    >
                        <LucideIcons.Printer size={16} />
                    </button>
                </div>
            </div>

            {/* Progress Summary mini-dashboard (Stitch Luxury Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print font-mono">
                {(() => {
                    const totalClients = filteredClients.length;
                    if (totalClients === 0) return null;
                    
                    const lastPeriod = periods[0];
                    const clientsWithObligations = filteredClients.filter(c => getObligationsForPeriod(c, lastPeriod).length > 0);
                    const totalClientsCount = clientsWithObligations.length;
                    const denominator = totalClientsCount > 0 ? totalClientsCount : totalClients;
                    
                    const declaredCount = filteredClients.filter(c => c.declarations?.some(d => d.period === lastPeriod && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada))).length;
                    const pdfCount = filteredClients.filter(c => c.declarations?.some(d => d.period === lastPeriod && d.proof_file)).length;
                    
                    const efficiencyPercent = Math.round((pdfCount / Math.max(1, denominator)) * 100);

                    return (
                        <>
                            <div className="p-5 rounded-3xl border border-white/10 border-t-white/20 bg-[#051424]/90 backdrop-blur-2xl shadow-2xl flex items-center gap-4 hover:translate-y-[-2px] transition-all">
                                <div className="p-3 bg-[#00A896]/15 text-[#00A896] rounded-2xl border border-[#00A896]/30 shadow-sm">
                                    <LucideIcons.CheckSquare size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Declarados</p>
                                    <p className="text-2xl font-black text-white leading-none font-mono">
                                        {declaredCount}
                                        <span className="text-xs text-slate-400 font-normal ml-1">/ {denominator}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="p-5 rounded-3xl border border-white/10 border-t-white/20 bg-[#051424]/90 backdrop-blur-2xl shadow-2xl flex items-center gap-4 hover:translate-y-[-2px] transition-all">
                                <div className="p-3 bg-[#2B6AFF]/15 text-[#2B6AFF] rounded-2xl border border-[#2B6AFF]/30 shadow-sm">
                                    <LucideIcons.Paperclip size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Respaldos</p>
                                    <p className="text-2xl font-black text-white leading-none font-mono">
                                        {pdfCount}
                                        <span className="text-xs text-slate-400 font-normal ml-1">/ {denominator}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="md:col-span-2 p-5 rounded-3xl border border-white/10 border-t-white/20 bg-[#051424]/90 backdrop-blur-2xl shadow-2xl flex flex-col justify-center hover:translate-y-[-2px] transition-all">
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {matrixMode === 'RENTA' ? 'Eficiencia Renta' : 'Eficiencia Mensual'}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Ciclo {formatPeriodForDisplay(lastPeriod)}</p>
                                    </div>
                                    <span className="text-lg font-black text-[#00A896]">{efficiencyPercent}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/10">
                                    <div 
                                        className="h-full rounded-full bg-gradient-to-r from-[#00A896] to-teal-400 shadow-[0_0_10px_rgba(0,168,150,0.4)] transition-all duration-1000"
                                        style={{ width: `${efficiencyPercent}%` }}
                                    ></div>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* 🚀 SUPER DOCK BAR DE ACCIONES MASIVAS (Stitch Nueva Luz 3.0) */}
            <div className="bg-gradient-to-r from-[#051424]/95 via-[#0b1326]/90 to-[#051424]/95 backdrop-blur-2xl p-5 rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-2xl flex flex-wrap items-center justify-between gap-4 font-mono">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleToggleSelectAll}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold font-mono uppercase tracking-wider transition-all border border-white/10 cursor-pointer active:scale-95"
                    >
                        <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={handleToggleSelectAll}
                            className="rounded accent-[#00A896] cursor-pointer w-3.5 h-3.5"
                        />
                        <span>{isAllSelected ? 'Desmarcar Todos' : 'Seleccionar Todos'} ({filteredClients.length})</span>
                    </button>
                    {selectedClientIds.length > 0 && (
                        <span className="px-4 py-2 rounded-2xl bg-[#00A896]/20 border border-[#00A896]/40 text-[#00A896] text-[10px] font-bold font-mono uppercase tracking-widest shadow-[0_0_10px_rgba(0,168,150,0.3)] animate-pulse">
                            🎯 {selectedClientIds.length} Seleccionados
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleBulkPrint}
                        disabled={selectedClientIds.length === 0}
                        className={`px-4 py-2.5 rounded-2xl text-[10px] font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg active:scale-95 border border-white/10 ${
                            selectedClientIds.length > 0
                                ? 'bg-gradient-to-r from-[#2B6AFF] to-blue-600 hover:from-blue-600 hover:to-indigo-600 text-white shadow-[#2B6AFF]/25 cursor-pointer'
                                : 'bg-slate-900/50 text-slate-500 cursor-not-allowed border-white/5'
                        }`}
                        title="Abrir lote de impresión con los PDFs de comprobante originales guardados en Supabase Storage"
                    >
                        <LucideIcons.Printer size={13} />
                        <span>🖨️ Imprimir Seleccionados</span>
                    </button>

                    <button
                        onClick={handleBulkDownload}
                        disabled={selectedClientIds.length === 0}
                        className={`px-4 py-2.5 rounded-2xl text-[10px] font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg active:scale-95 border border-white/10 ${
                            selectedClientIds.length > 0
                                ? 'bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white shadow-[#00A896]/25 cursor-pointer'
                                : 'bg-slate-900/50 text-slate-500 cursor-not-allowed border-white/5'
                        }`}
                        title="Descargar comprobantes PDF reales en lote"
                    >
                        <LucideIcons.Download size={13} />
                        <span>📥 Descargar PDFs</span>
                    </button>

                    <button
                        onClick={handleBulkWhatsAppNotify}
                        disabled={selectedClientIds.length === 0}
                        className={`px-4 py-2.5 rounded-2xl text-[10px] font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg active:scale-95 border border-white/10 ${
                            selectedClientIds.length > 0
                                ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-emerald-500/25 cursor-pointer'
                                : 'bg-slate-900/50 text-slate-500 cursor-not-allowed border-white/5'
                        }`}
                        title="Enviar notificación por WhatsApp con enlace al comprobante de Supabase"
                    >
                        <LucideIcons.Send size={13} />
                        <span>💬 Notificar WhatsApp</span>
                    </button>

                    <button
                        onClick={handleBulkMarkNotified}
                        disabled={selectedClientIds.length === 0}
                        className={`px-4 py-2.5 rounded-2xl text-[10px] font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 ${
                            selectedClientIds.length > 0
                                ? 'bg-white/5 hover:bg-white/10 text-[#00A896] border border-[#00A896]/30 cursor-pointer shadow-sm'
                                : 'bg-slate-900/50 text-slate-500 cursor-not-allowed border border-white/5'
                        }`}
                        title="Marcar como Notificados en la plataforma"
                    >
                        <LucideIcons.CheckCheck size={13} />
                        <span>Marcar Notificados</span>
                    </button>
                </div>
            </div>

            {/* Matrix Table */}
            <div className="rounded-[2.5rem] shadow-2xl overflow-hidden overflow-x-auto custom-scrollbar border border-white/10 border-t-white/20 bg-[#051424]/90 backdrop-blur-2xl font-sans mb-28">
                <table className="w-full min-w-[800px] text-left border-collapse">
                    <thead>
                        <tr className="bg-[#0b1326]/90 border-b border-white/10 font-mono">
                            <th className="px-3 py-4 sticky left-0 bg-[#0b1326] z-30 w-10 text-center border-r border-white/10">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={handleToggleSelectAll}
                                    className="rounded accent-[#00A896] cursor-pointer w-3.5 h-3.5"
                                    title="Seleccionar Todos"
                                />
                            </th>
                            <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] sticky left-10 bg-[#0b1326] z-20 w-64 border-r border-white/10">Cliente</th>
                            {periods.map(p => (
                                <th 
                                    key={p} 
                                    className="px-4 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center border-r border-white/10 last:border-r-0 cursor-pointer hover:bg-[#051424] transition-colors select-none group/th"
                                    onClick={() => handleSortByPeriod(p)}
                                    title="Clic para agrupar (Faltantes / Listos)"
                                >
                                    <div className="flex items-center justify-center gap-1.5 relative">
                                        <span>{formatPeriodForDisplay(p).replace('IVA ', '')}</span>
                                        <div className={`transition-all duration-200 ${sortPeriod === p ? 'opacity-100' : 'opacity-0 group-hover/th:opacity-30'}`}>
                                            <LucideIcons.ArrowDownUp 
                                                size={12} 
                                                className={sortPeriod === p ? (sortDirection === 'missing_first' ? 'text-rose-500' : 'text-[#00A896]') : 'text-slate-400'} 
                                            />
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-sans">
                        {filteredClients.map((client, index) => {
                            const currentDigit = parseInt(client.ruc[8], 10);
                            const prevDigit = index > 0 ? parseInt(filteredClients[index - 1].ruc[8], 10) : null;
                            const showDivider = sortOption === '9th_digit' && !isWorkspaceMode && (currentDigit !== prevDigit) && (!searchTerm.trim() || matrixMode !== 'IVA');

                            const getFreq = (c: Client) => c.taxProfile?.ivaFrequency || (c.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' : c.regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual');
                            const currentFreq = getFreq(client);
                            const prevFreq = index > 0 ? getFreq(filteredClients[index - 1]) : null;
                            const isSearchMode = searchTerm.trim().length > 0 && matrixMode === 'IVA';
                            const showFreqDivider = isSearchMode && (currentFreq !== prevFreq);

                            return (
                                <React.Fragment key={client.id}>
                                    {showFreqDivider && (
                                        <tr className="bg-[#2B6AFF]/10 border-t border-b border-[#2B6AFF]/20 font-mono">
                                            <td colSpan={periods.length + 2} className="px-6 py-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-1.5 rounded-lg bg-[#2B6AFF] text-white shadow-lg shadow-[#2B6AFF]/30 animate-pulse">
                                                            {currentFreq === 'Semestral' ? <LucideIcons.CalendarRange size={14} /> : <LucideIcons.Calendar size={14} />}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-[#2B6AFF] uppercase tracking-[0.2em]">
                                                            Clientes {currentFreq}es
                                                        </span>
                                                        <span className="text-white/20 mx-1">|</span>
                                                        <span className="text-[10px] text-slate-400 font-semibold tracking-wider">
                                                            Resultados de Búsqueda
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {showDivider && (
                                        <tr className="bg-[#0b1326]/80 border-t border-b border-white/10 font-mono">
                                            <td colSpan={periods.length + 2} className="px-6 py-2.5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_8px_rgba(0,168,150,0.8)]"></div>
                                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.15em]">
                                                            Dígito RUC <span className="font-mono text-[#00A896] font-black">{currentDigit}</span>
                                                        </span>
                                                        <span className="text-white/10 mx-1">|</span>
                                                        <span className="text-[9px] text-slate-400 font-mono tracking-wider">
                                                            Vence: Día {currentDigit === 1 ? '10' : currentDigit === 2 ? '12' : currentDigit === 3 ? '14' : currentDigit === 4 ? '16' : currentDigit === 5 ? '18' : currentDigit === 6 ? '20' : currentDigit === 7 ? '22' : currentDigit === 8 ? '24' : currentDigit === 9 ? '26' : '28'} de cada mes
                                                        </span>
                                                    </div>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest no-print">
                                                        {filteredClients.filter(c => parseInt(c.ruc[8], 10) === currentDigit).length} Clientes
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    <tr className={`transition-all duration-300 group/row border-b border-white/5 ${
    client.ruc === highlightedRuc
        ? 'bg-[#00A896]/15 ring-2 ring-[#00A896] border-[#00A896] shadow-[0_0_30px_rgba(0,168,150,0.4)] z-20 relative animate-pulse'
        : 'hover:bg-white/[0.03]'
}`}>
                                        <td 
                                            className="px-3 py-4 sticky left-0 bg-[#051424]/95 backdrop-blur-md z-20 border-r border-white/10 text-center"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedClientIds.includes(client.id)}
                                                onChange={() => handleToggleSelectClient(client.id)}
                                                className="rounded accent-[#00A896] cursor-pointer w-3.5 h-3.5"
                                            />
                                        </td>
                                        <td 
                                            className="px-6 py-4 sticky left-10 bg-[#051424]/95 backdrop-blur-md z-10 border-r border-white/10 group-hover/row:bg-[#0b1326]/95 transition-colors shadow-[4px_0_16px_rgba(0,0,0,0.5)]"
                                            onClick={() => onViewClient(client)}
                                        >
                                            <div className="flex items-center gap-3 cursor-pointer">
                                                <div className="w-8 h-8 rounded-xl bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] flex items-center justify-center font-bold text-xs font-mono group-hover/row:scale-105 transition-transform shadow-sm">
                                                    {client.ruc[8]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <h4 className="font-bold text-xs text-white truncate max-w-[170px] group-hover/row:text-[#00A896] transition-colors">
                                                            {client.tradeName || client.name}
                                                        </h4>
                                                        {client.isPriority && (
                                                            <LucideIcons.Star size={10} className="text-amber-400 fill-amber-400 shrink-0 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-0.5 font-mono">
                                                        {(() => {
                                                            const p12Days = getP12RemainingDays(client);
                                                            if (p12Days === null) {
                                                                return (
                                                                    <span className="text-[8px] font-bold text-slate-500 flex items-center gap-0.5">
                                                                        <LucideIcons.ShieldAlert size={8} /> Sin P12
                                                                    </span>
                                                                );
                                                            }
                                                            if (p12Days <= 0) {
                                                                return (
                                                                    <span className="text-[8px] font-bold text-rose-400 flex items-center gap-0.5 animate-pulse">
                                                                        <LucideIcons.AlertTriangle size={8} /> P12 Vencido
                                                                    </span>
                                                                );
                                                            }
                                                            if (p12Days <= 30) {
                                                                return (
                                                                    <span className="text-[8px] font-bold text-amber-400 flex items-center gap-0.5">
                                                                        <LucideIcons.Clock size={8} /> P12: {p12Days}d
                                                                    </span>
                                                                );
                                                            }
                                                            return (
                                                                <span className="text-[8px] font-bold text-[#00A896] flex items-center gap-0.5">
                                                                    <LucideIcons.ShieldCheck size={8} /> P12: {p12Days}d
                                                                </span>
                                                            );
                                                        })()}

                                                        {client.sriPassword ? (
                                                            <span className="text-[8px] font-bold text-emerald-400 flex items-center gap-0.5">
                                                                <LucideIcons.Key size={8} /> SRI Clave
                                                            </span>
                                                        ) : (
                                                            <span className="text-[8px] font-bold text-amber-400 flex items-center gap-0.5">
                                                                <LucideIcons.Lock size={8} /> Sin Clave
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1.5 mt-1 no-print font-mono">
                                                        <span className="text-[9px] font-mono font-bold text-slate-400 tracking-wider">
                                                            {client.ruc}
                                                        </span>
                                                        
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCopyRuc(client.ruc, client.name); }}
                                                            className={`p-1 rounded-lg transition-all border ${
                                                                copiedRuc === client.ruc
                                                                    ? 'bg-[#00A896]/20 border-[#00A896]/40 text-[#00A896]'
                                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                                            }`}
                                                            title={copiedRuc === client.ruc ? "RUC Copiado" : "Copiar RUC"}
                                                        >
                                                            {copiedRuc === client.ruc ? <LucideIcons.Check size={8} className="text-[#00A896]" strokeWidth={3} /> : <LucideIcons.Copy size={8} />}
                                                        </button>

                                                        {client.sriPassword && (
                                                            <button
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    handleCopyKey(client.sriPassword!, client.id, client.name);
                                                                }}
                                                                className={`p-1 rounded-lg transition-all border ${
                                                                    copiedKey === client.id
                                                                        ? 'bg-[#00A896]/20 border-[#00A896]/40 text-[#00A896]'
                                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-[#00A896] hover:border-[#00A896]/30'
                                                                }`}
                                                                title={copiedKey === client.id ? "Clave Copiada" : `Copiar Clave SRI`}
                                                            >
                                                                {copiedKey === client.id ? <LucideIcons.Check size={8} className="text-[#00A896]" strokeWidth={3} /> : <LucideIcons.Key size={8} />}
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={(e) => handleOpenSriPortal(client, e)}
                                                            className="p-1 rounded-lg border bg-white/5 border-white/10 text-slate-400 hover:text-amber-400 hover:border-amber-400/30 transition-all flex items-center justify-center"
                                                            title="Abrir SRI en Línea y Cargar Credenciales del Cliente"
                                                        >
                                                            <LucideIcons.ExternalLink size={8} />
                                                        </button>

                                                        {(() => {
                                                            const activePeriod = periods[0];
                                                            const clientDecls = client.declarations || [];
                                                            const mainObType = matrixMode === 'RENTA' ? 'RENTA' : 'IVA';
                                                            const mainDecl = findDeclarationForOb(clientDecls, activePeriod, mainObType);
                                                            
                                                            const hasProof = !!mainDecl?.proof_file || mainDecl?.status === DeclarationStatus.Enviada || mainDecl?.status === DeclarationStatus.Pagada;
                                                            const isPaid = mainDecl?.status === DeclarationStatus.Pagada || !!mainDecl?.is_paid || client.isCourtesy;
                                                            
                                                            if (!hasProof || isPaid) return null;

                                                            const isNotified = !!mainDecl?.isNotifiedWhatsApp;

                                                            return (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSendWhatsAppNotification(client, activePeriod, mainObType, mainDecl);
                                                                    }}
                                                                    onContextMenu={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleToggleWhatsAppNotification(client, activePeriod, mainObType, mainDecl);
                                                                    }}
                                                                    className={`p-1 rounded-lg transition-all border flex items-center justify-center ${
                                                                        isNotified
                                                                            ? 'bg-[#00A896]/15 border-[#00A896]/30 text-[#00A896] hover:bg-[#00A896]/25'
                                                                            : 'bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30 animate-pulse shadow-sm shadow-amber-500/20'
                                                                    }`}
                                                                    title={
                                                                        isNotified
                                                                            ? `Notificado por WhatsApp - Esperando comprobante de pago (Clic: reenviar | Clic derecho: alternar)`
                                                                            : `⚠️ Comprobante listo - FALTANTE DE AVISAR AL CLIENTE (Clic: enviar WhatsApp con saludo ${getTimeBasedGreeting()} | Clic derecho: marcar)`
                                                                    }
                                                                >
                                                                    {isNotified ? (
                                                                        <LucideIcons.CheckCheck size={10} strokeWidth={2.5} />
                                                                    ) : (
                                                                        <LucideIcons.BellRing size={10} strokeWidth={2.5} />
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        {periods.map(p => {
                                            const isBeforeStart = isPeriodBeforeClientStart(client, p);
                                            if (isBeforeStart) {
                                                return (
                                                    <td key={p} className="px-2 py-3 border-r border-white/5 bg-[#020b14]/40 opacity-70">
                                                        <div className="flex flex-col items-center justify-center p-2 rounded-2xl border border-white/5 text-[9px] font-mono text-slate-500 text-center gap-0.5" title={`Obligaciones iniciaron en ${client.clientStartPeriod}`}>
                                                            <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">
                                                                <LucideIcons.MinusCircle size={10} />
                                                                No Aplica
                                                            </span>
                                                            <span className="text-[7px] font-medium text-slate-500 font-mono">
                                                                Inicio {client.clientStartPeriod}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            const obligations = getObligationsForPeriod(client, p);
                                            const declarations = client.declarations || [];
                                            
                                            const allObligationsDone = obligations.length > 0 && obligations.every(ob => {
                                                const d = findDeclarationForOb(declarations, p, ob.type);
                                                return d && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada || !!d.proof_file);
                                            });

                                            return (
                                                <td key={p} className={`px-2 py-2 border-r border-white/5 last:border-r-0 transition-colors ${allObligationsDone ? 'bg-[#00A896]/[0.03]' : ''}`}>
                                                    {densityMode === 'compact' ? (
                                                        /* ⚡ MODO COMPACTO DE ALTA DENSIDAD (Sleek High Density Capsule) */
                                                        <div className="flex flex-col items-center justify-center gap-1 min-w-[90px] max-w-[125px] mx-auto py-0.5">
                                                            {obligations.map(ob => {
                                                                const d = findDeclarationForOb(declarations, p, ob.type);
                                                                const hasProof = !!d?.proof_file;
                                                                const isDone = hasProof || d?.status === DeclarationStatus.Pagada || d?.status === DeclarationStatus.Enviada || !!d?.is_paid;
                                                                const isOverdue = isPast(getDueDateForPeriod(client, p) || new Date()) && !isDone;
                                                                const isPaid = d?.status === DeclarationStatus.Pagada || !!d?.is_paid || client.isCourtesy;

                                                                return (
                                                                    <div
                                                                        key={`${p}-${ob.type}`}
                                                                        className={`group/ob relative flex items-center justify-between w-full px-2 py-1 rounded-xl cursor-pointer transition-all duration-200 border text-[10px] font-mono select-none shadow-sm ${
                                                                            isDone
                                                                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-400'
                                                                                : isOverdue
                                                                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25 animate-pulse'
                                                                                : d?.isPriority
                                                                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                                                                                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                                                                        }`}
                                                                        title={isDone ? `Declaración ${ob.label} lista con comprobante` : isOverdue ? `Urgente: Declaración ${ob.label} vencida` : `Subir o declarar ${ob.label}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (hasProof) {
                                                                                setActiveCellModal({
                                                                                    client,
                                                                                    period: p,
                                                                                    declaration: d!,
                                                                                    obType: ob.type as any,
                                                                                    realInvoice: findRealInvoice(client.ruc, d, p)
                                                                                });
                                                                            } else {
                                                                                onUploadReceipt(client, p, ob.type as any);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-1">
                                                                            {isDone ? (
                                                                                <LucideIcons.ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                                                                            ) : isOverdue ? (
                                                                                <LucideIcons.AlertCircle size={12} className="text-rose-400 shrink-0" />
                                                                            ) : d?.isPriority ? (
                                                                                <LucideIcons.Pin size={12} className="text-amber-400 shrink-0 rotate-45" />
                                                                            ) : (
                                                                                <LucideIcons.Upload size={11} className="text-slate-400 group-hover/ob:text-white shrink-0" />
                                                                            )}
                                                                            <span className="font-black text-[9px] uppercase tracking-wider">{ob.type}</span>
                                                                        </div>

                                                                        <div className="flex items-center gap-1">
                                                                            {hasProof && (
                                                                                <button
                                                                                    onClick={async (e) => {
                                                                                        e.stopPropagation();
                                                                                        if (d?.proof_file) {
                                                                                            await downloadStoredFile(d.proof_file, `comprobante_${client.name}_${p}.pdf`);
                                                                                        }
                                                                                    }}
                                                                                    className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                                                                    title="Descargar PDF"
                                                                                >
                                                                                    <LucideIcons.Download size={10} />
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (onTogglePayment) onTogglePayment(client, p, [ob.type as any], !isPaid);
                                                                                }}
                                                                                className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase transition-all ${
                                                                                    isPaid
                                                                                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                                                                                        : 'bg-white/10 text-slate-400 hover:text-white hover:bg-white/20'
                                                                                }`}
                                                                                title={isPaid ? "Honorario Cobrado (Clic para desmarcar)" : "Honorario Pendiente (Clic para marcar cobrado)"}
                                                                            >
                                                                                {isPaid ? '$OK' : 'COB'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {obligations.length === 0 && <span className="text-slate-600 font-mono text-[9px]">—</span>}
                                                        </div>
                                                    ) : (
                                                        /* 📑 MODO DETALLADO (Expanded Executive Cards) */
                                                        <>
                                                            <div className="flex flex-wrap justify-center gap-2 min-w-[70px]">
                                                                {obligations.map(ob => {
                                                                    const d = findDeclarationForOb(declarations, p, ob.type);
                                                                    const hasProof = !!d?.proof_file;
                                                                    const isDone = hasProof || d?.status === DeclarationStatus.Pagada || d?.status === DeclarationStatus.Enviada || !!d?.is_paid;
                                                                    const isManualDone = false;
                                                                    const isOverdue = isPast(getDueDateForPeriod(client, p) || new Date()) && !isDone;
                                                                    const isTrulyInvoiced = !!findRealInvoice(client.ruc, d, p) || !!(d as any)?.invoice_secuencial;

                                                                    return (
                                                                        <div 
                                                                            key={`${p}-${ob.type}`}
                                                                            className={`group/ob relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl cursor-pointer transition-all duration-300 border ${
                                                                                isDone ? 'bg-gradient-to-br from-[#00A896]/30 to-teal-600/30 text-white border-[#00A896]/50 shadow-md shadow-[#00A896]/15 hover:scale-105 hover:border-[#00A896] hover:shadow-lg hover:shadow-[#00A896]/25 z-10' : 
                                                                                isManualDone ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/15 hover:scale-105 hover:shadow-lg z-10 animate-pulse' :
                                                                                d?.isPriority ? 'bg-gradient-to-br from-orange-500/20 to-rose-500/20 text-orange-300 border-orange-500/50 shadow-md shadow-orange-500/15 hover:scale-105 hover:shadow-lg hover:shadow-orange-500/25 z-10 animate-pulse' :
                                                                                isOverdue ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25 hover:scale-105' :
                                                                                'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white hover:scale-105'
                                                                            }`}
                                                                            title={isDone ? `Ver Comprobante & Facturación de ${ob.label}` : isManualDone ? `Atención: Sin PDF de ${ob.label}. Haz click para subirlo.` : d?.isPriority ? `Prioridad Alta: Subir PDF para ${ob.label}` : `Subir PDF para ${ob.label}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (hasProof) {
                                                                                    setActiveCellModal({
                                                                                        client,
                                                                                        period: p,
                                                                                        declaration: d!,
                                                                                        obType: ob.type as any,
                                                                                        realInvoice: findRealInvoice(client.ruc, d, p)
                                                                                    });
                                                                                } else {
                                                                                    onUploadReceipt(client, p, ob.type as any);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <span className={`text-[7px] font-black tracking-widest uppercase mb-0.5 font-mono ${isDone || isManualDone || d?.isPriority ? 'opacity-95 text-[#00A896]' : 'opacity-60'}`}>{ob.type}</span>
                                                                            
                                                                            {isDone ? (
                                                                                <LucideIcons.ShieldCheck size={14} strokeWidth={3} className="text-[#00A896] drop-shadow-[0_0_6px_rgba(0,168,150,0.6)]" />
                                                                            ) : isManualDone ? (
                                                                                <LucideIcons.AlertTriangle size={14} strokeWidth={3} className="text-amber-400 drop-shadow-sm" />
                                                                            ) : d?.isPriority ? (
                                                                                <LucideIcons.Pin size={12} strokeWidth={2.5} className="text-orange-400 rotate-45" />
                                                                            ) : isOverdue ? (
                                                                                <LucideIcons.AlertCircle size={14} strokeWidth={2.5} className="text-rose-400" />
                                                                            ) : (
                                                                                <LucideIcons.Upload size={12} strokeWidth={2} className="opacity-40 group-hover/ob:opacity-100 group-hover/ob:scale-110 transition-all text-slate-300" />
                                                                            )}

                                                                            {isTrulyInvoiced && (
                                                                                <span className="px-1 py-[1.5px] bg-[#020b14]/90 text-[#00A896] border border-[#00A896]/50 rounded text-[6px] font-black uppercase tracking-wider font-mono shadow-sm mt-0.5 leading-none">
                                                                                    FACTURADO
                                                                                </span>
                                                                            )}

                                                                            {isDone ? (
                                                                                <>
                                                                                {hasProof && (
                                                                                    <button
                                                                                        onClick={async (e) => {
                                                                                            e.stopPropagation();
                                                                                            if (d?.proof_file) {
                                                                                                await downloadStoredFile(d.proof_file, `comprobante_${client.name}_${p}.pdf`);
                                                                                            }
                                                                                        }}
                                                                                        className="absolute -bottom-1.5 -left-1.5 rounded-full p-1 shadow-md transition-all z-20 bg-[#051424] hover:bg-[#0b1326] text-[#00A896] border border-[#00A896]/50 opacity-90 group-hover/ob:opacity-100 scale-100 hover:scale-110 flex items-center justify-center shadow-[0_0_8px_rgba(0,168,150,0.4)]"
                                                                                        title="Descargar PDF"
                                                                                    >
                                                                                        <LucideIcons.Download size={10} strokeWidth={3} />
                                                                                    </button>
                                                                                )}
                                                                                </>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (onTogglePriority) onTogglePriority(client, p, ob.type as any, !d?.isPriority);
                                                                                    }}
                                                                                    className={`absolute -top-1.5 -right-1.5 rounded-full p-0.5 shadow-sm transition-all z-20 ${
                                                                                        d?.isPriority 
                                                                                            ? 'bg-amber-500 text-white shadow-amber-500/20 scale-100' 
                                                                                            : 'bg-white/10 hover:bg-white/20 text-slate-400 border border-white/10 opacity-0 group-hover/ob:opacity-100 scale-90 hover:scale-110'
                                                                                    }`}
                                                                                    title={d?.isPriority ? "Quitar Prioridad" : "Marcar como Prioridad"}
                                                                                >
                                                                                    <LucideIcons.Pin size={8} strokeWidth={4} className={d?.isPriority ? 'rotate-45' : ''} />
                                                                                </button>
                                                                            )}
                                                                            {!hasProof && isOverdue && (
                                                                                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse border border-slate-900" />
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                                {obligations.length === 0 && <div className="w-1.5 h-1.5 rounded-full bg-white/10 my-6 mx-auto" />}
                                                            </div>
                                                            {obligations.length > 0 && (() => {
                                                                const allPaid = obligations.every(ob => {
                                                                    const d = findDeclarationForOb(declarations, p, ob.type);
                                                                    return d?.status === DeclarationStatus.Pagada || !!d?.is_paid || client.isCourtesy;
                                                                });
                                                                const isCellTrulyInvoiced = obligations.some(ob => {
                                                                    const d = findDeclarationForOb(declarations, p, ob.type);
                                                                    return !!findRealInvoice(client.ruc, d, p) || !!(d as any)?.invoice_secuencial;
                                                                });
                                                                const obTypes = obligations.map(ob => ob.type);

                                                                return (
                                                                    <div className="mt-2 flex justify-center font-mono">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (onTogglePayment) onTogglePayment(client, p, obTypes as any, !allPaid);
                                                                            }}
                                                                            className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-bold uppercase tracking-wider border transition-all duration-300 active:scale-95 ${
                                                                                allPaid && isCellTrulyInvoiced
                                                                                    ? 'bg-gradient-to-r from-[#2B6AFF] via-indigo-600 to-[#2B6AFF] hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/50 shadow-md shadow-[#2B6AFF]/25'
                                                                                    : allPaid
                                                                                        ? 'bg-[#00A896]/20 hover:bg-[#00A896]/30 border-[#00A896]/40 text-[#00A896] shadow-sm'
                                                                                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/10'
                                                                            }`}
                                                                        >
                                                                            {allPaid && isCellTrulyInvoiced ? (
                                                                                <>
                                                                                    <LucideIcons.ShieldCheck size={11} strokeWidth={2.5} className="text-blue-200" />
                                                                                    <span className="flex items-center gap-1">
                                                                                        <span className="font-bold text-white">COBRADO</span>
                                                                                        <span className="text-blue-200/80 font-bold">|</span>
                                                                                        <span className="font-bold text-blue-100">FACTURADO</span>
                                                                                    </span>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <LucideIcons.Coins size={11} strokeWidth={2.5} />
                                                                                    <span>{allPaid ? 'COBRADO' : `COBRO COMPLETO`}</span>
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
                {filteredClients.length === 0 && (
                    <div className="py-20 text-center font-mono">
                        <LucideIcons.Inbox size={32} className="mx-auto text-slate-600 mb-3" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay clientes para este criterio</p>
                    </div>
                )}
            </div>

            {/* Legend (Stitch Obsidian Luxury) */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#051424]/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-xl no-print font-mono">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Leyenda de Estados</span>
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-[#00A896] to-teal-600 flex items-center justify-center text-white text-[9px] shadow-sm">
                            <LucideIcons.Check size={10} strokeWidth={3} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Completado (PDF + Declaración)</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center text-[9px]">
                            <LucideIcons.Upload size={10} strokeWidth={2.5} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Sin Respaldo (Falta PDF)</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center relative text-[9px]">
                            <LucideIcons.AlertCircle size={10} strokeWidth={2.5} />
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Vencido (Urgente)</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative w-5 h-5 rounded-lg bg-gradient-to-br from-[#00A896] to-teal-600 flex items-center justify-center text-white text-[9px]">
                            <LucideIcons.Check size={10} strokeWidth={3} />
                            <div className="absolute -top-1 -right-1 bg-[#2B6AFF] text-white rounded-full p-0.5 shadow-sm">
                                <LucideIcons.DollarSign size={6} strokeWidth={4} />
                            </div>
                        </div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Honorario Pagado</span>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { 
                        size: landscape; 
                        margin: 1cm; 
                    }
                    body { 
                        background: white !important; 
                        color: black !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    .custom-scrollbar::-webkit-scrollbar { display: none; }
                    table { 
                        border-collapse: collapse !important;
                        width: 100% !important;
                        font-size: 8px !important;
                    }
                    th, td { 
                        border: 1px solid #e2e8f0 !important; 
                        padding: 8px !important;
                        background: transparent !important;
                        color: black !important;
                    }
            `}} />

            {/* Modal de Detalle de Celda: Comprobante PDF + Factura SRI */}
            {activeCellModal && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-[#020b14]/85 backdrop-blur-xl animate-in fade-in duration-300 font-sans">
                    <div className="relative w-full max-w-xl bg-[#051424]/95 border border-white/10 border-t-white/20 rounded-[2.5rem] shadow-2xl p-6 overflow-hidden flex flex-col gap-6 text-white backdrop-blur-2xl">
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 rounded-2xl shadow-sm">
                                    <LucideIcons.ShieldCheck size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight text-white font-display">
                                        Comprobante & Facturación SRI
                                    </h3>
                                    <p className="text-xs font-semibold text-slate-400 font-mono">
                                        {activeCellModal.client.tradeName || activeCellModal.client.name} — <span className="font-mono text-[#00A896]">{activeCellModal.period}</span> ({activeCellModal.obType})
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveCellModal(null)}
                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
                            >
                                <LucideIcons.X size={18} />
                            </button>
                        </div>

                        {/* 📑 PESTAÑAS DE CLASIFICACIÓN DE COMPROBANTES */}
                        <div className="flex items-center gap-1.5 p-1 bg-[#020b14]/60 rounded-2xl border border-white/10 font-mono">
                            <button
                                onClick={() => setModalTab('declaracion')}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                                    modalTab === 'declaracion'
                                        ? 'bg-gradient-to-r from-[#00A896] to-teal-600 text-white shadow-lg shadow-[#00A896]/25 border border-white/10'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <LucideIcons.FileText size={14} />
                                <span>📄 Declaración SRI</span>
                            </button>
                            <button
                                onClick={() => setModalTab('factura')}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                                    modalTab === 'factura'
                                        ? 'bg-gradient-to-r from-[#2B6AFF] to-indigo-600 text-white shadow-lg shadow-[#2B6AFF]/25 border border-white/10'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <LucideIcons.Receipt size={14} />
                                <span>🧾 Factura RIDE</span>
                            </button>
                            <button
                                onClick={() => setModalTab('respaldos')}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                                    modalTab === 'respaldos'
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 border border-white/10'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <LucideIcons.FolderCheck size={14} />
                                <span>📑 Respaldos</span>
                            </button>
                        </div>

                        {/* Content Body segun Pestaña Seleccionada */}
                        <div className="space-y-4 min-h-[220px]">
                            {/* PESTAÑA 1: DECLARACIÓN SRI */}
                            {modalTab === 'declaracion' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    {/* Comprobante PDF */}
                                    <div className="p-4 bg-[#0b1326]/80 border border-white/10 rounded-2xl flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <LucideIcons.FileText size={16} className="text-[#00A896]" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                                                    Comprobante de Declaración PDF
                                                </span>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 font-mono ${
                                                activeCellModal.declaration.proof_file?.url 
                                                    ? 'bg-[#00A896]/20 text-[#00A896] border border-[#00A896]/40 shadow-sm shadow-[#00A896]/20' 
                                                    : activeCellModal.declaration.proof_file?.content 
                                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                                                    : 'bg-slate-800 text-slate-400 border border-white/10'
                                            }`}>
                                                {activeCellModal.declaration.proof_file?.url ? (
                                                    <>
                                                        <LucideIcons.Cloud size={11} className="text-[#00A896]" />
                                                        <span>Almacenado en la Nube</span>
                                                    </>
                                                ) : activeCellModal.declaration.proof_file?.content ? (
                                                    <>
                                                        <LucideIcons.AlertTriangle size={11} className="text-amber-400" />
                                                        <span>Local Base64</span>
                                                    </>
                                                ) : (
                                                    <span>Sin Comprobante</span>
                                                )}
                                            </span>
                                        </div>

                                        <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
                                            <span className="truncate max-w-[280px]">
                                                Archivo: <span className="text-slate-200 font-semibold">{activeCellModal.declaration.proof_file?.name || `declaracion_${activeCellModal.period}.pdf`}</span>
                                            </span>
                                            {activeCellModal.declaration.proof_file?.size && (
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {(activeCellModal.declaration.proof_file.size / 1024).toFixed(1)} KB
                                                </span>
                                            )}
                                        </div>

                                        {activeCellModal.declaration.proof_file?.url ? (
                                            <div className="rounded-xl overflow-hidden border border-white/10 bg-[#020b14] max-h-48 relative group">
                                                <iframe src={activeCellModal.declaration.proof_file.url} className="w-full h-44 border-none" title="Vista Previa SRI" />
                                                <a 
                                                    href={activeCellModal.declaration.proof_file.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="absolute top-2 right-2 p-1.5 bg-[#051424]/90 hover:bg-[#051424] border border-white/20 rounded-lg text-slate-300 hover:text-white transition-all shadow-md"
                                                    title="Abrir en pestaña nueva"
                                                >
                                                    <LucideIcons.ExternalLink size={12} />
                                                </a>
                                            </div>
                                        ) : activeCellModal.declaration.proof_file?.content ? (
                                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center justify-between font-mono">
                                                <span className="text-[11px]">Este PDF está guardado en base64 local. Puedes migrarlo a la nube para reducir el gasto de Supabase.</span>
                                                <button
                                                    onClick={async () => {
                                                        const fakeEvent = {
                                                            target: {
                                                                files: [
                                                                    new File(
                                                                        [new Blob([activeCellModal.declaration.proof_file!.content!], { type: 'application/pdf' })],
                                                                        activeCellModal.declaration.proof_file?.name || `declaracion_${activeCellModal.period}.pdf`,
                                                                        { type: 'application/pdf' }
                                                                    )
                                                                ]
                                                            }
                                                        } as any;
                                                        await handleUploadProofPdf(fakeEvent);
                                                    }}
                                                    disabled={isUploadingProof}
                                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                                >
                                                    <LucideIcons.UploadCloud size={12} />
                                                    Migrar
                                                </button>
                                            </div>
                                        ) : null}

                                        {/* Acciones del Comprobante */}
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 font-mono">
                                            {/* Input para subir o reemplazar PDF directamente a la nube */}
                                            <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all border ${
                                                isUploadingProof 
                                                    ? 'bg-slate-800 text-slate-500 border-white/5 cursor-wait' 
                                                    : 'bg-[#2B6AFF]/15 hover:bg-[#2B6AFF]/25 border-[#2B6AFF]/30 text-[#2B6AFF] hover:text-white shadow-sm'
                                            }`}>
                                                {isUploadingProof ? (
                                                    <>
                                                        <LucideIcons.RefreshCw size={14} className="animate-spin text-[#2B6AFF]" />
                                                        <span>Subiendo a la Nube...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <LucideIcons.UploadCloud size={14} />
                                                        <span>{activeCellModal.declaration.proof_file ? 'Reemplazar en Nube' : 'Subir PDF a la Nube'}</span>
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    accept=".pdf"
                                                    disabled={isUploadingProof}
                                                    onChange={handleUploadProofPdf}
                                                    className="hidden"
                                                />
                                            </label>

                                            {activeCellModal.declaration.proof_file && (
                                                <button
                                                    onClick={async () => {
                                                        const ok = await downloadStoredFile(
                                                            activeCellModal.declaration.proof_file,
                                                            `comprobante_${activeCellModal.client.name}_${activeCellModal.period}.pdf`
                                                        );
                                                        if (ok) {
                                                            toast.success("Comprobante descargado correctamente");
                                                        } else {
                                                            toast.error("El archivo del comprobante no se pudo descargar");
                                                        }
                                                    }}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#00A896]/20 cursor-pointer border border-white/10"
                                                >
                                                    <LucideIcons.Download size={14} />
                                                    Descargar PDF
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    const decl = activeCellModal.declaration;
                                                    const clientObj = activeCellModal.client;
                                                    setActiveCellModal(null);
                                                    onPreviewReceipt(clientObj, decl);
                                                }}
                                                className="py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-white/10"
                                            >
                                                <LucideIcons.Eye size={14} />
                                                Ver Detalle
                                            </button>
                                        </div>
                                    </div>

                                    {/* Notificación WhatsApp al Cliente */}
                                    <div className="p-4 bg-[#0b1326]/80 border border-white/10 rounded-2xl flex flex-col gap-3 font-mono">
                                        {(() => {
                                            const currentCount = activeCellModal.declaration.notificationCount || 0;
                                            const isPaid = activeCellModal.declaration.status === DeclarationStatus.Pagada || !!activeCellModal.declaration.is_paid || activeCellModal.client.isCourtesy;
                                            const isNotified = !!activeCellModal.declaration.isNotifiedWhatsApp;

                                            let stageLabel = "Etapa 1: Notificación Inicial";
                                            let buttonLabel = `Enviar Comprobante WhatsApp (${getTimeBasedGreeting()})`;
                                            let stageColor = "text-[#00A896]";
                                            let IconComponent = LucideIcons.Send;

                                            if (isNotified && !isPaid) {
                                                if (currentCount <= 1) {
                                                    stageLabel = "Etapa 2: Primer Recordatorio de Pago";
                                                    buttonLabel = `Enviar Recordatorio de Cobro (${getTimeBasedGreeting()})`;
                                                    stageColor = "text-amber-400";
                                                    IconComponent = LucideIcons.BellRing;
                                                } else {
                                                    stageLabel = `Etapa ${currentCount + 1}: Seguimiento de Pago`;
                                                    buttonLabel = `Enviar Mensaje de Seguimiento de Pago`;
                                                    stageColor = "text-rose-400";
                                                    IconComponent = LucideIcons.AlertCircle;
                                                }
                                            }

                                            return (
                                                <>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <IconComponent size={16} className={stageColor} />
                                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                                                                Notificación WhatsApp ({stageLabel})
                                                            </span>
                                                        </div>
                                                        {isNotified ? (
                                                            <span className="px-2.5 py-1 bg-[#00A896]/20 text-[#00A896] border border-[#00A896]/30 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-[0_0_6px_rgba(0,168,150,0.4)]">
                                                                <LucideIcons.CheckCheck size={12} />
                                                                NOTIFICADO ({currentCount}x)
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                                <LucideIcons.Bookmark size={12} />
                                                                PENDIENTE DE NOTIFICAR
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                                                        <button
                                                            onClick={() => handleSendWhatsAppNotification(activeCellModal.client, activeCellModal.period, activeCellModal.obType, activeCellModal.declaration)}
                                                            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 cursor-pointer border border-white/10"
                                                        >
                                                            <IconComponent size={14} />
                                                            {buttonLabel}
                                                        </button>

                                                        <button
                                                            onClick={() => handleToggleWhatsAppNotification(activeCellModal.client, activeCellModal.period, activeCellModal.obType, activeCellModal.declaration)}
                                                            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                                                                activeCellModal.declaration.isNotifiedWhatsApp
                                                                    ? 'bg-[#051424] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border-white/10 hover:border-rose-500/40'
                                                                    : 'bg-[#00A896]/20 hover:bg-[#00A896]/30 text-[#00A896] border-[#00A896]/30'
                                                            }`}
                                                            title="Cambiar marca de notificación sin enviar mensaje por WhatsApp"
                                                        >
                                                            <LucideIcons.Tag size={14} />
                                                            <span>{activeCellModal.declaration.isNotifiedWhatsApp ? 'Marcar Pendiente' : 'Marcar Notificado'}</span>
                                                        </button>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* PESTAÑA 2: FACTURA ELECTRÓNICA / RIDE */}
                            {modalTab === 'factura' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="p-4 bg-[#0b1326]/80 border border-white/10 rounded-2xl flex flex-col gap-3">
                                        <div className="flex items-center justify-between font-mono">
                                            <div className="flex items-center gap-2">
                                                <LucideIcons.Receipt size={16} className={activeCellModal.realInvoice ? "text-[#2B6AFF]" : "text-amber-400"} />
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                                                    Factura Electrónica de Honorarios SRI
                                                </span>
                                            </div>
                                            {activeCellModal.realInvoice ? (
                                                <span className="px-2.5 py-1 bg-[#2B6AFF]/20 text-[#2B6AFF] border border-[#2B6AFF]/30 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                                    ✅ FACTURA REGISTRADA
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                                    ⚠️ SIN FACTURA EN REGISTRO
                                                </span>
                                            )}
                                        </div>

                                        {activeCellModal.realInvoice ? (
                                            <div className="space-y-2 bg-[#020b14] p-3.5 rounded-xl border border-[#2B6AFF]/20 font-mono text-xs">
                                                <div className="flex justify-between text-slate-300 font-bold">
                                                    <span>Factura Autorizada SRI:</span>
                                                    <span className="text-[#2B6AFF]">001-001-{activeCellModal.realInvoice.secuencial}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-400 text-[10px]">
                                                    <span>Fecha Autorización:</span>
                                                    <span className="text-slate-200">{activeCellModal.realInvoice.fechaEmision}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-400 text-[10px]">
                                                    <span>Monto Total:</span>
                                                    <span className="text-[#00A896] font-bold">${Number(activeCellModal.realInvoice.total || 0).toFixed(2)}</span>
                                                </div>
                                                <div className="text-[9px] text-slate-400 truncate border-t border-white/5 pt-1.5 mt-1">
                                                    Clave: <span className="text-slate-300">{activeCellModal.realInvoice.claveAcceso}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 leading-relaxed bg-amber-500/5 p-3.5 rounded-xl border border-amber-500/20 font-mono">
                                                No consta factura electrónica autorizada emitida a este RUC ({activeCellModal.client.ruc}) para esta declaración en el registro local.
                                            </p>
                                        )}

                                        <div className="flex items-center gap-2 pt-1 font-mono">
                                            {activeCellModal.realInvoice ? (
                                                <button
                                                    onClick={() => {
                                                        printRideFromInvoice(activeCellModal.realInvoice, activeCellModal.client);
                                                    }}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#2B6AFF] to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#2B6AFF]/20 cursor-pointer border border-white/10"
                                                >
                                                    <LucideIcons.FileText size={14} />
                                                    Ver RIDE Factura (A4)
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        const ruc = activeCellModal.client.ruc;
                                                        const periodStr = activeCellModal.period;
                                                        const { description } = formatDeclarationInvoiceDescription(periodStr, activeCellModal.obType);
                                                        setActiveCellModal(null);
                                                        if (onNavigateToBilling) onNavigateToBilling(ruc, periodStr, description);
                                                        else toast.info(`Selecciona Facturación SRI para emitir comprobante a ${ruc}`);
                                                    }}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 cursor-pointer border border-white/10"
                                                >
                                                    <LucideIcons.Zap size={14} />
                                                    Emitir Factura SRI Ahora
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* PESTAÑA 3: RETENCIONES & RESPALDOS DE BÓVEDA */}
                            {modalTab === 'respaldos' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="p-4 bg-[#0b1326]/80 border border-white/10 rounded-2xl flex flex-col gap-3">
                                        <div className="flex items-center justify-between font-mono">
                                            <div className="flex items-center gap-2">
                                                <LucideIcons.FolderCheck size={16} className="text-indigo-400" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                                                    Métricas Extraídas & Retenciones
                                                </span>
                                            </div>
                                            <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                                Métricas SRI
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                            <div className="bg-[#020b14] p-2.5 rounded-xl border border-white/5">
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">Ventas 15%:</div>
                                                <div className="text-[#00A896] font-black text-sm">${(activeCellModal.declaration.proof_file?.metadata?.ventas15 || 0).toFixed(2)}</div>
                                            </div>
                                            <div className="bg-[#020b14] p-2.5 rounded-xl border border-white/5">
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">Ventas 0%:</div>
                                                <div className="text-slate-200 font-black text-sm">${(activeCellModal.declaration.proof_file?.metadata?.ventas0 || 0).toFixed(2)}</div>
                                            </div>
                                            <div className="bg-[#020b14] p-2.5 rounded-xl border border-white/5">
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">Compras 15%:</div>
                                                <div className="text-sky-400 font-black text-sm">${(activeCellModal.declaration.proof_file?.metadata?.compras15 || 0).toFixed(2)}</div>
                                            </div>
                                            <div className="bg-[#020b14] p-2.5 rounded-xl border border-white/5">
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">Retenciones IVA:</div>
                                                <div className="text-indigo-400 font-black text-sm">${(activeCellModal.declaration.proof_file?.metadata?.retIva || 0).toFixed(2)}</div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold text-slate-400 font-mono">
                                            <span>Documentos en Bóveda del Cliente:</span>
                                            <span className="text-indigo-400 font-bold">{(activeCellModal.client.vaultFiles || []).length} archivos</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 pt-4 font-mono">
                            <button
                                onClick={() => handleOpenSriPortal(activeCellModal.client)}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 border border-white/10 cursor-pointer"
                            >
                                <LucideIcons.Key size={14} />
                                <span>🔑 Abrir SRI & Cargar Credenciales</span>
                            </button>
                            <button
                                onClick={() => setActiveCellModal(null)}
                                className="w-full sm:w-auto px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-all border border-white/10 cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Command Dock Flotante de Matriz via Portal (Adapta opacidad según Scroll & Integración Visual) */}
            {createPortal(
                (() => {
                    const isHeader = scrollY < 100;
                    let calculatedOpacity = 0;
                    if (!isHeader) {
                        if (scrollY >= 360) {
                            calculatedOpacity = 1;
                        } else {
                            // Entre encabezado y fila 3/4 (100px a 360px)
                            calculatedOpacity = 0.15 + ((scrollY - 100) / 260) * 0.85;
                        }
                    }

                    return (
                        <div 
                            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] max-w-[95vw] md:max-w-2xl w-auto no-print transition-all duration-500 group ${
                                isHeader ? 'pointer-events-none translate-y-8 scale-95 opacity-0' : 'pointer-events-auto translate-y-0 scale-100'
                            }`}
                            style={{
                                opacity: isHeader ? 0 : calculatedOpacity
                            }}
                        >
                            <div className="backdrop-blur-2xl bg-[#051424]/95 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_20px_rgba(0,168,150,0.2)] group-hover:!opacity-100 rounded-full px-4 py-2.5 flex items-center gap-2 sm:gap-3 text-white transition-all duration-300 font-mono">
                                
                                {/* Selector de Modo (Mensual / Semestral / Renta) */}
                                <div className="flex items-center gap-1 bg-[#020b14]/70 p-1 rounded-full border border-white/10">
                                    {[
                                        { id: 'dock-iva-mensual', label: 'Mensual', short: 'M', mode: 'IVA' as MatrixMode, freq: 'Mensual' as IvaFrequency, icon: LucideIcons.Calendar },
                                        { id: 'dock-iva-semestral', label: 'Semestral', short: 'S', mode: 'IVA' as MatrixMode, freq: 'Semestral' as IvaFrequency, icon: LucideIcons.CalendarRange },
                                        { id: 'dock-renta-anual', label: 'Renta', short: 'R', mode: 'RENTA' as MatrixMode, freq: 'Ninguno' as IvaFrequency, icon: LucideIcons.Award }
                                    ].map(tab => {
                                        const isActive = matrixMode === tab.mode && (tab.mode === 'RENTA' || frequency === tab.freq);
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setMatrixMode(tab.mode);
                                                    if (tab.mode === 'IVA') setFrequency(tab.freq);
                                                }}
                                                className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                                                    isActive
                                                        ? 'bg-gradient-to-r from-[#00A896] to-teal-600 text-white shadow-lg shadow-[#00A896]/30 scale-[1.03] border border-white/10'
                                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                                }`}
                                                title={`Cambiar vista a ${tab.label}`}
                                            >
                                                <tab.icon size={12} />
                                                <span className="hidden sm:inline">{tab.label}</span>
                                                <span className="inline sm:hidden">{tab.short}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Separador */}
                                <div className="h-5 w-px bg-white/15 hidden sm:block" />

                                {/* Buscador Rápido Flotante */}
                                <div className="relative flex-1 min-w-[110px] max-w-[170px] sm:max-w-[200px]">
                                    <LucideIcons.Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar cliente..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-6 py-1.5 bg-[#020b14]/70 hover:bg-[#020b14] focus:bg-[#020b14] border border-white/10 focus:border-[#00A896]/50 rounded-full text-[11px] font-medium text-white placeholder:text-slate-500 focus:outline-none transition-all"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                                            <LucideIcons.X size={10} />
                                        </button>
                                    )}
                                </div>

                                {/* Contenedor de Botones de Navegación (Scroll Top / Bottom) */}
                                <div className="flex items-center gap-1.5">
                                    {/* Botón Scroll to Top ↑ */}
                                    <button
                                        onClick={() => {
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                            const main = document.querySelector('main');
                                            if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="p-2 rounded-full bg-[#00A896]/15 hover:bg-[#00A896] text-[#00A896] hover:text-white border border-[#00A896]/30 transition-all duration-300 shadow-sm hover:scale-110 active:scale-95 shrink-0 cursor-pointer"
                                        title="Subir al inicio de la Matriz (Scroll to Top)"
                                    >
                                        <LucideIcons.ArrowUp size={14} strokeWidth={2.5} />
                                    </button>

                                    {/* Botón Scroll to Bottom ↓ */}
                                    <button
                                        onClick={() => {
                                            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                                            const main = document.querySelector('main');
                                            if (main) main.scrollTo({ top: main.scrollHeight, behavior: 'smooth' });
                                        }}
                                        className="p-2 rounded-full bg-white/5 hover:bg-[#2B6AFF] text-slate-300 hover:text-white border border-white/10 hover:border-[#2B6AFF] transition-all duration-300 shadow-sm hover:scale-110 active:scale-95 shrink-0 cursor-pointer"
                                        title="Bajar al final de la Matriz (Scroll to Bottom)"
                                    >
                                        <LucideIcons.ArrowDown size={14} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* Total Clientes Badge */}
                                <span className="hidden md:inline-flex px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono font-bold text-slate-400">
                                    {filteredClients.length}
                                </span>
                            </div>
                        </div>
                    );
                })(),
                document.body
            )}

            {/* Modal Emergente Post-Subida de Comprobante (3 Acciones Rápidas) */}
            {postUploadModal && (
                <div className="fixed inset-0 bg-[#020b14]/85 backdrop-blur-xl z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300 font-sans">
                    <div className="bg-[#051424]/95 border border-white/10 border-t-white/20 rounded-[2.5rem] p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-300 backdrop-blur-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-[#00A896]/15 text-[#00A896] rounded-2xl border border-[#00A896]/30 shadow-sm">
                                    <LucideIcons.FileCheck size={22} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider font-display">Comprobante Registrado</h3>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{postUploadModal.client.tradeName || postUploadModal.client.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPostUploadModal(null)}
                                className="p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                            >
                                <LucideIcons.X size={16} />
                            </button>
                        </div>

                        <div className="p-4 bg-[#0b1326]/80 rounded-2xl border border-white/5 space-y-2 text-xs font-mono">
                            <div className="flex justify-between text-slate-300">
                                <span className="text-slate-400">Obligación:</span>
                                <span className="font-bold text-white uppercase">{postUploadModal.obType} - {formatPeriodForDisplay(postUploadModal.period)}</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <span className="text-slate-400">Estado Notificación:</span>
                                <span className="text-amber-400 font-bold uppercase">Pendiente de avisar</span>
                            </div>
                        </div>

                        <div className="space-y-2.5 pt-1 font-mono">
                            {/* Acción 1: Notificar por WhatsApp de una vez */}
                            <button
                                onClick={() => {
                                    const modalData = postUploadModal;
                                    setPostUploadModal(null);
                                    handleSendWhatsAppNotification(modalData.client, modalData.period, modalData.obType, modalData.declaration);
                                }}
                                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 border border-white/10 cursor-pointer active:scale-95"
                            >
                                <LucideIcons.MessageSquare size={16} />
                                📲 Enviar Notificación WhatsApp ({getTimeBasedGreeting()})
                            </button>

                            {/* Acción 2: Marcar como Pagado Ahora */}
                            <button
                                onClick={() => {
                                    const modalData = postUploadModal;
                                    setPostUploadModal(null);
                                    if (onTogglePayment) {
                                        onTogglePayment(modalData.client, modalData.period, modalData.obType as any, true);
                                    } else {
                                        const decls = modalData.client.declarations || [];
                                        const updatedDecls = decls.map(d => {
                                            if (arePeriodsEqual(d.period, modalData.period)) {
                                                return { ...d, is_paid: true, status: DeclarationStatus.Pagada, paidAt: new Date().toISOString() };
                                            }
                                            return d;
                                        });
                                        useAppStore.getState().updateClient(modalData.client.id, { declarations: updatedDecls });
                                    }
                                    toast.success(`Declaración marcada como PAGADA`);
                                }}
                                className="w-full py-3 bg-[#0b1326] hover:bg-slate-800 text-[#00A896] border border-[#00A896]/30 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                            >
                                <LucideIcons.CheckCircle2 size={16} />
                                💳 Marcar como Pagado Ahora
                            </button>

                            {/* Acción 3: Cerrar / Notificar Luego */}
                            <button
                                onClick={() => {
                                    toast.info("Comprobante guardado. Notificación dejada PENDIENTE para después.");
                                    setPostUploadModal(null);
                                }}
                                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer"
                            >
                                ✕ Cerrar (Notificar Luego)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
