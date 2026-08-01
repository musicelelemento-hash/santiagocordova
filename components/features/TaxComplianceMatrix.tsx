
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

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus, IvaFrequency, Declaration, TaxRegime, TaxObligationType } from '../../types';
import { formatPeriodForDisplay, getPeriod, getDueDateForPeriod, downloadStoredFile } from '../../services/sri';
import { format, subMonths, startOfMonth, endOfMonth, isPast, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClientCompliance, getObligationsForPeriod, isPeriodBeforeClientStart } from '../../services/complianceEngine';
import { useToast } from '../../context/ToastContext';

import { SriCampaignWidget } from './SriCampaignWidget';
import { getNinthDigit } from '../../services/sri';

import { db } from '../../services/db';
import { useAppStore } from '../../store/useAppStore';
import { getClientServiceFee } from '../../services/clientService';

type MatrixMode = 'IVA' | 'RENTA';

interface TaxComplianceMatrixProps {
    clients: Client[];
    onViewClient: (client: Client) => void;
    onUploadReceipt: (client: Client, period: string, type: TaxObligationType) => void;
    onPreviewReceipt: (client: Client, declaration: Declaration) => void;
    onTogglePayment?: (client: Client, period: string, type: TaxObligationType, isPaid: boolean) => void;
    onTogglePriority?: (client: Client, period: string, type: TaxObligationType, isPriority: boolean) => void;
    onNavigateToBilling?: (clientRuc: string) => void;
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
    const [activeCellModal, setActiveCellModal] = useState<{
        client: Client;
        period: string;
        declaration: Declaration;
        obType: TaxObligationType;
        realInvoice: any | null;
    } | null>(null);

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

    const findRealInvoice = (clientRuc: string, d?: Declaration) => {
        if (!sriHistory || sriHistory.length === 0) return null;
        const cleanRuc = clientRuc.replace(/\D/g, '');
        
        // 1. Direct match by secuencial if recorded in declaration
        const declSec = (d as any)?.invoice_secuencial || (d?.transactionId?.startsWith('001-') ? d.transactionId : null);
        if (declSec) {
            const found = sriHistory.find(h => h.estado === 'Autorizado' && (h.secuencial === declSec || h.secuencial?.endsWith(declSec)));
            if (found) return found;
        }

        // 2. Match by client RUC in authorized invoices
        const matches = sriHistory.filter(h => 
            h.estado === 'Autorizado' && 
            h.tipo === 'factura' && 
            (h.rucReceptor?.replace(/\D/g, '') === cleanRuc)
        );

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

        toast.success(
            `🔑 Credenciales de ${client.name} cargadas. RUC: ${client.ruc} ${client.sriPassword ? '· Clave lista para autocompletar' : ''}`
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

            return isActive && clientFreq === frequency;
        }).sort((a, b) => {
            const priorityA = hasPriorityDeclaration(a);
            const priorityB = hasPriorityDeclaration(b);
            if (priorityA !== priorityB) {
                return priorityA ? -1 : 1;
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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Controls */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white/95 dark:bg-slate-900/40 backdrop-blur-xl p-5 rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-4">
                    <div className={`p-3 text-white rounded-2xl shadow-lg ${
                        matrixMode === 'RENTA' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-primary shadow-primary/20'
                    }`}>
                        {matrixMode === 'RENTA' ? <LucideIcons.Award size={20} /> : <LucideIcons.LayoutGrid size={20} />}
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight font-premium">
                            {matrixMode === 'RENTA' ? 'Matriz de Renta Anual' : 'Matriz de Obligaciones'}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                            {matrixMode === 'RENTA' ? 'Impuesto a la Renta · Historial Fiscal' : 'Control de Respaldos de IVA'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Buscador Directo en Matriz */}
                    <div className="relative flex-1 min-w-[220px] sm:min-w-[280px]">
                        <LucideIcons.Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="🔍 Buscar cliente o RUC en Matriz..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 bg-slate-100/90 dark:bg-slate-950/60 border border-slate-200/50 dark:border-white/10 rounded-2xl text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-slate-200 dark:bg-white/10 hover:bg-rose-500 hover:text-white text-slate-400 transition-all"
                                title="Limpiar filtro"
                            >
                                <LucideIcons.X size={10} strokeWidth={3} />
                            </button>
                        )}
                    </div>
                    {/* Control de Ordenamiento: Dígito vs Semáforo de Colores vs Alfabético */}
                    <div className="flex flex-wrap items-center gap-1 bg-slate-100/80 dark:bg-slate-950/40 p-1 rounded-2xl border border-slate-200/30 dark:border-white/5">
                        <button
                            onClick={() => setSortOption('9th_digit')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                sortOption === '9th_digit'
                                    ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                            }`}
                            title="Ordenar por Dígito RUC (Calendario SRI)"
                        >
                            <LucideIcons.Binary size={12} />
                            <span>Dígito</span>
                        </button>

                        <button
                            onClick={() => setSortOption('color_orange')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                                sortOption === 'color_orange'
                                    ? 'bg-orange-500 text-white border-orange-600 shadow-md shadow-orange-500/20 scale-[1.02]'
                                    : 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20'
                            }`}
                            title="Ver Naranjas Primero (Declarado, Falta Cancelar/Cobrar)"
                        >
                            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                            <span>Naranjas</span>
                        </button>

                        <button
                            onClick={() => setSortOption('color_red')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                                sortOption === 'color_red'
                                    ? 'bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-500/20 scale-[1.02]'
                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                            }`}
                            title="Ver Rojos Primero (Vencidos / Urgentes)"
                        >
                            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                            <span>Rojos</span>
                        </button>

                        <button
                            onClick={() => setSortOption('color_green')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                                sortOption === 'color_green'
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-500/20 scale-[1.02]'
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                            title="Ver Verdes Primero (Al Día y Pagados)"
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>Verdes</span>
                        </button>

                        <button
                            onClick={() => setSortOption('alphabetical')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                sortOption === 'alphabetical'
                                    ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                            }`}
                            title="Ordenar por Nombre Alfabético (A - Z)"
                        >
                            <LucideIcons.SortAsc size={12} />
                            <span>A-Z</span>
                        </button>
                    </div>

                    {/* Integrated Segmented Control for Mode/Frequency */}
                    <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-950/40 p-1 rounded-2xl border border-slate-200/30 dark:border-white/5">
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
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                                        isActive 
                                            ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                                            : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
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
                            className="bg-slate-100/80 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 text-[10px] font-black uppercase tracking-wider px-3.5 py-2.5 rounded-xl border border-slate-200/30 dark:border-white/5 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-white/15 transition-all shadow-sm"
                        >
                            {[today.getFullYear(), today.getFullYear() - 1].map(y => (
                                <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">{y}</option>
                            ))}
                        </select>
                    )}

                    {/* Workspace desk switcher */}
                    <button
                        onClick={() => setIsWorkspaceMode(!isWorkspaceMode)}
                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 border shadow-sm ${
                            isWorkspaceMode 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-500/50 shadow-emerald-500/10' 
                                : 'bg-slate-100/80 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 border-slate-200/30 dark:border-white/5 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                        title="Priorizar clientes con obligaciones pendientes"
                    >
                        <LucideIcons.Briefcase size={12} />
                        <span>{isWorkspaceMode ? 'Pendientes Primero' : 'Orden Dígito'}</span>
                    </button>

                    <button 
                        onClick={() => window.print()}
                        className="p-2.5 bg-slate-100/80 dark:bg-slate-950/40 text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-white rounded-xl border border-slate-200/30 dark:border-white/5 transition-all no-print shadow-sm"
                        title="Imprimir Reporte"
                    >
                        <LucideIcons.Printer size={16} />
                    </button>
                </div>
            </div>

            {/* Progress Summary mini-dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
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
                            <div className="glass-card-premium p-4 flex items-center gap-4 hover:translate-y-[-2px] transition-all">
                                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                                    <LucideIcons.CheckSquare size={18} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-0.5">Declarados</p>
                                    <p className="text-xl font-extrabold text-slate-900 dark:text-white leading-none font-premium">
                                        {declaredCount}
                                        <span className="text-xs text-slate-400 font-bold ml-1">/ {denominator}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="glass-card-premium p-4 flex items-center gap-4 hover:translate-y-[-2px] transition-all">
                                <div className="p-3 bg-sky-500/10 text-sky-500 rounded-2xl">
                                    <LucideIcons.Paperclip size={18} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-0.5">Respaldos</p>
                                    <p className="text-xl font-extrabold text-slate-900 dark:text-white leading-none font-premium">
                                        {pdfCount}
                                        <span className="text-xs text-slate-400 font-bold ml-1">/ {denominator}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="md:col-span-2 glass-card-premium p-4 flex flex-col justify-center tactical-glow-primary hover:translate-y-[-2px] transition-all">
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest">
                                            {matrixMode === 'RENTA' ? 'Eficiencia Renta' : 'Eficiencia Mensual'}
                                        </p>
                                        <p className="text-[8px] font-bold text-slate-400/80 uppercase tracking-wider mt-0.5">Ciclo {formatPeriodForDisplay(lastPeriod)}</p>
                                    </div>
                                    <span className="text-base font-extrabold text-emerald-500 font-premium">{efficiencyPercent}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-slate-200/30 dark:border-white/10">
                                    <div 
                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-1000"
                                        style={{ width: `${efficiencyPercent}%` }}
                                    ></div>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* Matrix Table */}
            <div className="glass-card-premium rounded-[2rem] shadow-tactical overflow-hidden overflow-x-auto custom-scrollbar border border-slate-200/50 dark:border-white/10">
                <table className="w-full min-w-[800px] text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-200/30 dark:border-white/5">
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] sticky left-0 bg-slate-50 dark:bg-slate-900 z-20 w-64 border-r border-slate-200/30 dark:border-white/10">Cliente</th>
                            {periods.map(p => (
                                <th 
                                    key={p} 
                                    className="px-4 py-4 text-[9px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-[0.15em] text-center border-r border-slate-200/30 dark:border-white/5 last:border-r-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none group/th"
                                    onClick={() => handleSortByPeriod(p)}
                                    title="Clic para agrupar (Faltantes / Listos)"
                                >
                                    <div className="flex items-center justify-center gap-1.5 relative">
                                        {formatPeriodForDisplay(p).replace('IVA ', '')}
                                        <div className={`transition-all duration-200 ${sortPeriod === p ? 'opacity-100' : 'opacity-0 group-hover/th:opacity-30'}`}>
                                            <LucideIcons.ArrowDownUp 
                                                size={12} 
                                                className={sortPeriod === p ? (sortDirection === 'missing_first' ? 'text-rose-500' : 'text-emerald-500') : 'text-slate-400'} 
                                            />
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/20 dark:divide-white/5">
                        {filteredClients.map((client, index) => {
                            const currentDigit = parseInt(client.ruc[8], 10);
                            const prevDigit = index > 0 ? parseInt(filteredClients[index - 1].ruc[8], 10) : null;
                            const showDivider = sortOption === '9th_digit' && !isWorkspaceMode && (currentDigit !== prevDigit);

                            return (
                                <React.Fragment key={client.id}>
                                    {showDivider && (
                                        <tr className="bg-slate-100/30 dark:bg-[#020617]/50 border-t border-b border-slate-200/30 dark:border-white/10">
                                            <td colSpan={periods.length + 1} className="px-6 py-2.5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(43,106,255,0.6)]"></div>
                                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] font-premium">
                                                            Dígito RUC <span className="font-mono text-primary font-black">{currentDigit}</span>
                                                        </span>
                                                        <span className="text-slate-300 dark:text-white/10 mx-1">|</span>
                                                        <span className="text-[9px] text-slate-400 dark:text-slate-400 font-mono tracking-wider">
                                                            Vence: Día {currentDigit === 1 ? '10' : currentDigit === 2 ? '12' : currentDigit === 3 ? '14' : currentDigit === 4 ? '16' : currentDigit === 5 ? '18' : currentDigit === 6 ? '20' : currentDigit === 7 ? '22' : currentDigit === 8 ? '24' : currentDigit === 9 ? '26' : '28'} de cada mes
                                                        </span>
                                                    </div>
                                                    <span className="text-[8px] font-bold text-slate-400/80 uppercase tracking-widest no-print">
                                                        {filteredClients.filter(c => parseInt(c.ruc[8], 10) === currentDigit).length} Clientes
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    <tr className={`transition-all duration-700 group/row ${
    client.ruc === highlightedRuc
        ? 'bg-primary/10 dark:bg-primary/20 ring-2 ring-primary border-primary shadow-[0_0_30px_rgba(59,130,246,0.5)] z-20 relative animate-pulse'
        : 'hover:bg-slate-50/50 dark:bg-white/[0.02] dark:hover:bg-slate-950/20'
}`}>
                                        <td 
                                            className="px-6 py-4 sticky left-0 bg-white/95 dark:bg-[#020617]/95 backdrop-blur-md z-10 border-r border-slate-200/30 dark:border-white/10 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-950/80 transition-colors shadow-[4px_0_12px_-4px_rgba(0,0,0,0.03)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.4)]"
                                            onClick={() => onViewClient(client)}
                                        >
                                            <div className="flex items-center gap-3 cursor-pointer group/name relative">
                                                {/* ZEN 3.1 Compliance Dot */}
                                                {(() => {
                                                    const compliance = getClientCompliance(client, today, (frequency === 'Ninguno' ? 'all' : frequency) as any);
                                                    const dotColor = 
                                                        compliance.overallColor === 'red' ? 'bg-rose-500 shadow-rose-500/50' :
                                                        compliance.overallColor === 'orange' ? 'bg-orange-500 shadow-orange-500/50' :
                                                        compliance.overallColor === 'yellow' ? 'bg-amber-400 shadow-amber-400/50' :
                                                        compliance.overallColor === 'green' ? 'bg-emerald-500 shadow-emerald-500/50' :
                                                        'bg-slate-400';
                                                    return (
                                                        <div 
                                                            className={`absolute -left-2 w-1.5 h-6 rounded-full transition-all duration-300 ${dotColor}`}
                                                            title={`Cumplimiento: ${compliance.score}%`}
                                                        />
                                                    );
                                                })()}
                                                {(() => {
                                                    const compliance = getClientCompliance(client, today, (frequency === 'Ninguno' ? 'all' : frequency) as any);
                                                    const colorClasses = 
                                                        compliance.overallColor === 'red' ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 font-black shadow-sm shadow-rose-500/10' :
                                                        compliance.overallColor === 'orange' ? 'bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400 font-black shadow-sm shadow-orange-500/10 animate-pulse' :
                                                        compliance.overallColor === 'yellow' ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 font-black' :
                                                        compliance.overallColor === 'green' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-black' :
                                                        'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500';
                                                    return (
                                                        <div 
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-mono tracking-wider transition-all border ${colorClasses}`}
                                                            title={`Semáforo: ${compliance.overallColor.toUpperCase()} (${compliance.score}% al día)`}
                                                        >
                                                            {client.ruc[8]}
                                                        </div>
                                                    );
                                                })()}
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black truncate max-w-[160px] text-slate-900 dark:text-white group-hover/name:text-primary transition-colors font-premium">
                                                            {client.tradeName || client.name}
                                                        </span>
                                                        {client.ruc === highlightedRuc && (
                                                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-primary text-white shadow-lg shadow-primary/50 animate-bounce shrink-0">
                                                                🎯 DESTACADO
                                                            </span>
                                                        )}
                                                        {isWorkspaceMode && (
                                                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                                                isClientUpToDate(client) 
                                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                                                    : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse'
                                                            }`}>
                                                                {isClientUpToDate(client) ? 'Al Día' : 'Pendiente'}
                                                            </span>
                                                        )}
                                                        {/* ── Firma Electrónica Neon Dot ── */}
                                                        {(() => {
                                                            if (!client.signatureFile) {
                                                                return (
                                                                    <span
                                                                        title="Sin firma electrónica"
                                                                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shrink-0"
                                                                    >
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                                                        <span className="text-[8px] font-bold text-slate-400 uppercase hidden sm:inline">Sin firma</span>
                                                                    </span>
                                                                );
                                                            }
                                                            const daysLeft = client.signatureExpirationDate
                                                                ? (() => {
                                                                    const exp = new Date(client.signatureExpirationDate);
                                                                    exp.setHours(0,0,0,0);
                                                                    const now = new Date(); now.setHours(0,0,0,0);
                                                                    return Math.ceil((exp.getTime() - now.getTime()) / 86400000);
                                                                })()
                                                                : null;
                                                            if (daysLeft === null) {
                                                                return (
                                                                    <span title="Firma cargada (fecha desconocida)" className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 shrink-0">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" style={{boxShadow:'0 0 6px rgba(20,184,166,0.8)'}} />
                                                                    </span>
                                                                );
                                                            }
                                                            if (daysLeft < 0) {
                                                                return (
                                                                    <span title={`Firma CADUCADA hace ${Math.abs(daysLeft)} días`} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 shrink-0">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" style={{boxShadow:'0 0 6px rgba(239,68,68,0.8)'}} />
                                                                        <span className="text-[8px] font-black text-rose-500 uppercase hidden sm:inline">Caducada</span>
                                                                    </span>
                                                                );
                                                            }
                                                            if (daysLeft <= 30) {
                                                                return (
                                                                    <span title={`Firma vence en ${daysLeft} días`} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 shrink-0">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" style={{boxShadow:'0 0 6px rgba(251,191,36,0.8)'}} />
                                                                        <span className="text-[8px] font-black text-amber-500 uppercase hidden sm:inline">{daysLeft}d</span>
                                                                    </span>
                                                                );
                                                            }
                                                            return (
                                                                <span title={`Firma activa · ${daysLeft} días restantes`} className="flex items-center px-1.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 shrink-0">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" style={{boxShadow:'0 0 6px rgba(20,184,166,0.8)'}} />
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div className="flex items-center gap-1.5 mt-1 no-print">
                                                        <span className="text-[9px] font-mono font-bold text-slate-400 tracking-wider">
                                                            {client.ruc}
                                                        </span>
                                                        
                                                        {/* Copiar RUC */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCopyRuc(client.ruc, client.name); }}
                                                            className={`p-1 rounded transition-all border ${
                                                                copiedRuc === client.ruc
                                                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500'
                                                                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-primary hover:border-primary/30'
                                                            }`}
                                                            title={copiedRuc === client.ruc ? "RUC Copiado" : "Copiar RUC"}
                                                        >
                                                            {copiedRuc === client.ruc ? <LucideIcons.Check size={8} className="text-emerald-500" strokeWidth={3} /> : <LucideIcons.Copy size={8} />}
                                                        </button>

                                                        {/* Copiar Clave SRI */}
                                                        {client.sriPassword && (
                                                            <button
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    handleCopyKey(client.sriPassword!, client.id, client.name);
                                                                }}
                                                                className={`p-1 rounded transition-all border ${
                                                                    copiedKey === client.id
                                                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500'
                                                                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-emerald-500 hover:border-emerald-500/30'
                                                                }`}
                                                                title={copiedKey === client.id ? "Clave Copiada" : `Copiar Clave SRI`}
                                                            >
                                                                {copiedKey === client.id ? <LucideIcons.Check size={8} className="text-emerald-500" strokeWidth={3} /> : <LucideIcons.Key size={8} />}
                                                            </button>
                                                        )}

                                                        {/* Enlace SRI con Autocarga de Credenciales */}
                                                        <button
                                                            onClick={(e) => handleOpenSriPortal(client, e)}
                                                            className="p-1 rounded border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-amber-400 hover:border-amber-400/30 transition-all flex items-center justify-center"
                                                            title="Abrir SRI en Línea y Cargar Credenciales del Cliente"
                                                        >
                                                            <LucideIcons.ExternalLink size={8} />
                                                        </button>

                                                        {/* Icono Minimalista de Notificación WhatsApp por Cliente (Solo cuando hay comprobante y no está todo pagado) */}
                                                        {(() => {
                                                            const activePeriod = periods[0];
                                                            const clientDecls = client.declarations || [];
                                                            const mainObType = matrixMode === 'RENTA' ? 'RENTA' : 'IVA';
                                                            const mainDecl = findDeclarationForOb(clientDecls, activePeriod, mainObType);
                                                            
                                                            // Si no hay declaración/comprobante cargado, o si ya está todo pagado, NO MOSTRAR (0 ruido visual)
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
                                                                    className={`p-1 rounded-md transition-all border flex items-center justify-center ${
                                                                        isNotified
                                                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20'
                                                                            : 'bg-amber-500/20 border-amber-500/50 text-amber-500 hover:bg-amber-500/30 animate-pulse shadow-sm shadow-amber-500/20'
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

                                                    <span className="text-[9px] font-mono font-bold text-slate-400 tracking-wider mt-1 print-only hidden">
                                                        {client.ruc}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        {periods.map(p => {
                                            const isBeforeStart = isPeriodBeforeClientStart(client, p);
                                            if (isBeforeStart) {
                                                return (
                                                    <td key={p} className="px-2 py-3 border-r border-slate-200/20 dark:border-white/5 bg-slate-100/30 dark:bg-slate-950/40 opacity-75">
                                                        <div className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200/30 dark:border-white/5 text-[9px] font-mono text-slate-400 text-center gap-0.5" title={`Obligaciones iniciaron en ${client.clientStartPeriod}`}>
                                                            <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                                                                <LucideIcons.MinusCircle size={10} />
                                                                No Aplica
                                                            </span>
                                                            <span className="text-[7px] font-bold text-slate-500 font-sans">
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
                                                <td key={p} className={`px-2 py-3 border-r border-slate-200/20 dark:border-white/5 last:border-r-0 transition-colors ${allObligationsDone ? 'bg-emerald-500/[0.02] dark:bg-emerald-500/[0.03]' : ''}`}>
                                                    <div className="flex flex-wrap justify-center gap-2 min-w-[70px]">
                                                        {obligations.map(ob => {
                                                            const d = findDeclarationForOb(declarations, p, ob.type);
                                                            const hasProof = !!d?.proof_file;
                                                            const isPaid = d?.status === DeclarationStatus.Pagada || !!d?.is_paid || client.isCourtesy;
                                                            const isSent = d?.status === DeclarationStatus.Enviada || isPaid || hasProof;
                                                            
                                                            const realInvoice = findRealInvoice(client.ruc, d);
                                                            const isTrulyInvoiced = !!realInvoice || !!(d as any)?.invoice_secuencial;

                                                            const isDone = hasProof || d?.status === DeclarationStatus.Pagada || d?.status === DeclarationStatus.Enviada || !!d?.is_paid;
                                                            const isManualDone = false;
                                                            const isOverdue = isPast(getDueDateForPeriod(client, p) || new Date()) && !isDone;

                                                            return (
                                                                <div 
                                                                    key={`${p}-${ob.type}`}
                                                                    className={`group/ob relative flex flex-col items-center justify-center w-14 h-14 rounded-xl cursor-pointer transition-all duration-300 border ${
                                                                        isDone ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-600/50 shadow-md shadow-emerald-500/10 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20 z-10' : 
                                                                        isManualDone ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white border-amber-500/50 shadow-md shadow-amber-500/10 hover:scale-105 hover:shadow-lg z-10 animate-pulse' :
                                                                        d?.isPriority ? 'bg-gradient-to-br from-orange-500 to-rose-500 text-white border-orange-600/50 shadow-md shadow-orange-500/10 hover:scale-105 hover:shadow-lg hover:shadow-orange-500/25 z-10 animate-pulse' :
                                                                        isOverdue ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-500 dark:text-rose-400 border-rose-250 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-950/30 hover:scale-105' :
                                                                        'bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-400 border-slate-200/50 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-600 dark:hover:text-slate-200 hover:scale-105'
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
                                                                                realInvoice
                                                                            });
                                                                        } else {
                                                                            onUploadReceipt(client, p, ob.type as any);
                                                                        }
                                                                    }}
                                                                >
                                                                    <span className={`text-[7px] font-black tracking-widest uppercase mb-0.5 ${isDone || isManualDone || d?.isPriority ? 'opacity-90' : 'opacity-55'}`}>{ob.type}</span>
                                                                    
                                                                    {isDone ? (
                                                                        <LucideIcons.ShieldCheck size={14} strokeWidth={3} className="text-white drop-shadow-sm" />
                                                                    ) : isManualDone ? (
                                                                        <LucideIcons.AlertTriangle size={14} strokeWidth={3} className="text-white drop-shadow-sm" />
                                                                    ) : d?.isPriority ? (
                                                                        <LucideIcons.Pin size={12} strokeWidth={2.5} className="text-white rotate-45" />
                                                                    ) : isOverdue ? (
                                                                        <LucideIcons.AlertCircle size={14} strokeWidth={2.5} />
                                                                    ) : (
                                                                        <LucideIcons.Upload size={12} strokeWidth={2} className="opacity-40 group-hover/ob:opacity-100 group-hover/ob:scale-110 transition-all" />
                                                                    )}

                                                                    {/* Resaltador / Barra FACTURADO solo si consta factura real en registros */}
                                                                    {isTrulyInvoiced && (
                                                                        <span className="px-1 py-[1.5px] bg-slate-950/85 text-emerald-300 border border-emerald-400/50 rounded text-[6px] font-black uppercase tracking-wider font-mono shadow-sm mt-0.5 leading-none">
                                                                            FACTURADO
                                                                        </span>
                                                                    )}

                                                                    {isDone ? (
                                                                        <>
                                                                        {/* Botón Descargar PDF Directo */}
                                                                        {hasProof && (
                                                                            <button
                                                                                onClick={async (e) => {
                                                                                    e.stopPropagation();
                                                                                    if (d?.proof_file) {
                                                                                        const ok = await downloadStoredFile(d.proof_file, `comprobante_${client.name}_${p}.pdf`);
                                                                                        if (ok) {
                                                                                            toast.success("Comprobante descargado correctamente");
                                                                                        } else {
                                                                                            toast.error("No se pudo procesar el archivo PDF del comprobante");
                                                                                        }
                                                                                    } else {
                                                                                        toast.info("Este comprobante fue registrado sin un archivo PDF adjunto");
                                                                                    }
                                                                                }}
                                                                                className="absolute -bottom-1.5 -left-1.5 rounded-full p-1 shadow-md transition-all z-20 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/50 opacity-90 group-hover/ob:opacity-100 scale-100 hover:scale-110 flex items-center justify-center"
                                                                                title="Descargar PDF Directo del Comprobante"
                                                                            >
                                                                                <LucideIcons.Download size={10} strokeWidth={3} />
                                                                            </button>
                                                                        )}
                                                                        {/* Botón WhatsApp */}
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const msg = encodeURIComponent(`Buen día, le adjunto el comprobante de la declaración.`);
                                                                                const phoneStr = client.phones && client.phones.length > 0 ? client.phones[0].replace(/\D/g, '') : '';
                                                                                if (phoneStr) {
                                                                                    const whatsappPhone = phoneStr.startsWith('0') ? '593' + phoneStr.substring(1) : (phoneStr.startsWith('593') ? phoneStr : '593' + phoneStr);
                                                                                    window.open(`https://wa.me/${whatsappPhone}?text=${msg}`, '_blank');
                                                                                } else {
                                                                                    alert('El cliente no tiene un número de teléfono registrado.');
                                                                                }
                                                                            }}
                                                                            className={`absolute -bottom-1.5 -right-1.5 rounded-full p-1 shadow-sm transition-all z-20 bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 opacity-0 group-hover/ob:opacity-100 scale-90 hover:scale-110`}
                                                                            title="Notificar por WhatsApp"
                                                                        >
                                                                            <LucideIcons.MessageCircle size={10} strokeWidth={2.5} />
                                                                        </button>
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
                                                                                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300/30 dark:border-slate-700/30 opacity-0 group-hover/ob:opacity-100 scale-90 hover:scale-110'
                                                                            }`}
                                                                            title={d?.isPriority ? "Quitar Prioridad" : "Marcar como Prioridad"}
                                                                        >
                                                                            <LucideIcons.Pin size={8} strokeWidth={4} className={d?.isPriority ? 'rotate-45' : ''} />
                                                                        </button>
                                                                    )}
                                                                    {!hasProof && isOverdue && (
                                                                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse border border-white dark:border-slate-900" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {obligations.length === 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-200/30 dark:bg-white/5 my-6 mx-auto" />}
                                                    </div>
                                                    {obligations.length > 0 && (() => {
                                                         const allPaid = obligations.every(ob => {
                                                             const d = findDeclarationForOb(declarations, p, ob.type);
                                                             return d?.status === DeclarationStatus.Pagada || !!d?.is_paid || client.isCourtesy;
                                                         });
                                                         const isCellTrulyInvoiced = obligations.some(ob => {
                                                             const d = findDeclarationForOb(declarations, p, ob.type);
                                                             const realInvoice = findRealInvoice(client.ruc, d);
                                                             return !!realInvoice || !!(d as any)?.invoice_secuencial;
                                                         });
                                                         const obTypes = obligations.map(ob => ob.type);

                                                         return (
                                                             <div className="mt-2 flex justify-center">
                                                                 <button
                                                                     onClick={(e) => {
                                                                         e.stopPropagation();
                                                                         if (onTogglePayment) {
                                                                             onTogglePayment(client, p, obTypes as any, !allPaid);
                                                                         }
                                                                     }}
                                                                     className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all duration-300 ${
                                                                         allPaid && isCellTrulyInvoiced
                                                                             ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/50 shadow-md shadow-blue-500/25 active:scale-95'
                                                                             : allPaid
                                                                                 ? 'bg-sky-500 hover:bg-sky-600 border-sky-600 text-white shadow-sm active:scale-95'
                                                                                 : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 active:scale-95'
                                                                     }`}
                                                                     title={
                                                                         allPaid && isCellTrulyInvoiced
                                                                             ? "Cobrado y Facturado (Click para revertir a pendiente)"
                                                                             : allPaid
                                                                                 ? "Marcar todo como Pendiente"
                                                                                 : "Marcar Cobro Completo"
                                                                     }
                                                                 >
                                                                     {allPaid && isCellTrulyInvoiced ? (
                                                                         <>
                                                                             <LucideIcons.ShieldCheck size={11} strokeWidth={2.5} className="text-blue-200" />
                                                                             <span className="flex items-center gap-1">
                                                                                 <span className="font-black text-white">COBRADO</span>
                                                                                 <span className="text-blue-200/80 font-bold">|</span>
                                                                                 <span className="font-black text-blue-100">FACTURADO</span>
                                                                             </span>
                                                                         </>
                                                                     ) : (
                                                                         <>
                                                                             <LucideIcons.Coins size={11} strokeWidth={2.5} />
                                                                             <span>
                                                                                 {allPaid ? 'COBRADO' : `COBRO COMPLETO ($${getClientServiceFee(client, serviceFees, p)})`}
                                                                             </span>
                                                                         </>
                                                                     )}
                                                                 </button>
                                                             </div>
                                                         );
                                                     })()}
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
                    <div className="py-20 text-center">
                        <LucideIcons.Inbox size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">No hay clientes para este criterio</p>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-white/40 dark:bg-slate-900/20 backdrop-blur-md rounded-2xl border border-slate-200/30 dark:border-white/5 no-print">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-premium">Leyenda de Estados</span>
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[9px]">
                            <LucideIcons.Check size={10} strokeWidth={3} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider">Completado (PDF + Declaración)</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700/40 flex items-center justify-center text-[9px]">
                            <LucideIcons.Upload size={10} strokeWidth={2.5} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider">Sin Respaldo (Falta PDF)</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-rose-50 dark:bg-rose-950/20 text-rose-500 border border-rose-200 dark:border-rose-900/40 flex items-center justify-center relative text-[9px]">
                            <LucideIcons.AlertCircle size={10} strokeWidth={2.5} />
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider">Vencido (Urgente)</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative w-5 h-5 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[9px]">
                            <LucideIcons.Check size={10} strokeWidth={3} />
                            <div className="absolute -top-1 -right-1 bg-sky-500 text-white rounded-full p-0.25 shadow-sm">
                                <LucideIcons.DollarSign size={6} strokeWidth={4} />
                            </div>
                        </div>
                        <span className="text-[9px] font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider">Honorario Pagado</span>
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
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl p-6 overflow-hidden flex flex-col gap-6 text-white">
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
                                    <LucideIcons.ShieldCheck size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight text-white font-premium">
                                        Comprobante & Facturación SRI
                                    </h3>
                                    <p className="text-xs font-semibold text-slate-400">
                                        {activeCellModal.client.tradeName || activeCellModal.client.name} — <span className="font-mono text-emerald-400">{activeCellModal.period}</span> ({activeCellModal.obType})
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveCellModal(null)}
                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                            >
                                <LucideIcons.X size={18} />
                            </button>
                        </div>

                        {/* Content Cards */}
                        <div className="space-y-4">
                            {/* 1. Comprobante de Declaración (PDF Subido) */}
                            <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LucideIcons.FileText size={16} className="text-emerald-400" />
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                                            Comprobante de Declaración PDF
                                        </span>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[9px] font-black uppercase tracking-wider">
                                        Registrado
                                    </span>
                                </div>

                                <div className="text-xs font-mono text-slate-400 truncate">
                                    Archivo: <span className="text-slate-200">{activeCellModal.declaration.proof_file?.name || `declaracion_${activeCellModal.period}.pdf`}</span>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
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
                                                    toast.error("El archivo del comprobante no se pudo decodificar");
                                                }
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20"
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
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                    >
                                        <LucideIcons.Eye size={14} />
                                        Ver Previa
                                    </button>
                                </div>
                            </div>

                            {/* 2. Estado de Factura SRI de Verdad */}
                            <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LucideIcons.Receipt size={16} className={activeCellModal.realInvoice ? "text-sky-400" : "text-amber-400"} />
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                                            Factura Electrónica SRI
                                        </span>
                                    </div>
                                    {activeCellModal.realInvoice ? (
                                        <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full text-[9px] font-black uppercase tracking-wider">
                                            ✅ FACTURA REAL REGISTRADA
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[9px] font-black uppercase tracking-wider">
                                            ⚠️ SIN FACTURA EN REGISTRO
                                        </span>
                                    )}
                                </div>

                                {activeCellModal.realInvoice ? (
                                    <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-sky-500/20 font-mono text-xs">
                                        <div className="flex justify-between text-slate-300 font-bold">
                                            <span>Factura Autorizada SRI:</span>
                                            <span className="text-sky-400">001-001-{activeCellModal.realInvoice.secuencial}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400 text-[10px]">
                                            <span>Fecha Autorización:</span>
                                            <span className="text-slate-200">{activeCellModal.realInvoice.fechaEmision}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400 text-[10px]">
                                            <span>Monto Total:</span>
                                            <span className="text-emerald-400 font-bold">${Number(activeCellModal.realInvoice.total || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="text-[9px] text-slate-400 truncate border-t border-white/5 pt-1.5 mt-1">
                                            Clave: <span className="text-slate-300">{activeCellModal.realInvoice.claveAcceso}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 leading-relaxed bg-amber-500/5 p-3.5 rounded-xl border border-amber-500/20">
                                        No consta factura electrónica autorizada emitida a este RUC ({activeCellModal.client.ruc}) para esta declaración en el registro local.
                                    </p>
                                )}

                                <div className="flex items-center gap-2 pt-1">
                                    {activeCellModal.realInvoice ? (
                                        <button
                                            onClick={() => {
                                                printRideFromInvoice(activeCellModal.realInvoice, activeCellModal.client);
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-gradient-azure text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-primary/20"
                                        >
                                            <LucideIcons.FileText size={14} />
                                            Ver RIDE Factura (A4)
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                const ruc = activeCellModal.client.ruc;
                                                setActiveCellModal(null);
                                                if (onNavigateToBilling) onNavigateToBilling(ruc);
                                                else toast.info(`Selecciona Facturación SRI para emitir comprobante a ${ruc}`);
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20"
                                        >
                                            <LucideIcons.Zap size={14} />
                                            Emitir Factura SRI Ahora
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 3. Notificación WhatsApp al Cliente */}
                            <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl flex flex-col gap-3">
                                {(() => {
                                    const currentCount = activeCellModal.declaration.notificationCount || 0;
                                    const isPaid = activeCellModal.declaration.status === DeclarationStatus.Pagada || !!activeCellModal.declaration.is_paid || activeCellModal.client.isCourtesy;
                                    const isNotified = !!activeCellModal.declaration.isNotifiedWhatsApp;

                                    let stageLabel = "Etapa 1: Notificación Inicial";
                                    let buttonLabel = `Enviar Comprobante WhatsApp (${getTimeBasedGreeting()})`;
                                    let stageColor = "text-emerald-400";
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
                                                    <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                                                        Notificación WhatsApp ({stageLabel})
                                                    </span>
                                                </div>
                                                {isNotified ? (
                                                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                                        <LucideIcons.CheckCheck size={12} />
                                                        NOTIFICADO ({currentCount}x)
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                                        <LucideIcons.Bookmark size={12} />
                                                        PENDIENTE DE NOTIFICAR
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                                                <button
                                                    onClick={() => handleSendWhatsAppNotification(activeCellModal.client, activeCellModal.period, activeCellModal.obType, activeCellModal.declaration)}
                                                    className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20"
                                                >
                                                    <IconComponent size={14} />
                                                    {buttonLabel}
                                                </button>

                                                <button
                                                    onClick={() => handleToggleWhatsAppNotification(activeCellModal.client, activeCellModal.period, activeCellModal.obType, activeCellModal.declaration)}
                                                    className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border ${
                                                        activeCellModal.declaration.isNotifiedWhatsApp
                                                            ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border-slate-700 hover:border-rose-500/40'
                                                            : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
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

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 pt-4">
                            <button
                                onClick={() => handleOpenSriPortal(activeCellModal.client)}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                            >
                                <LucideIcons.Key size={14} />
                                <span>🔑 Abrir SRI & Cargar Credenciales</span>
                            </button>
                            <button
                                onClick={() => setActiveCellModal(null)}
                                className="w-full sm:w-auto px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
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
                            // 1a fila (~100px): ~15% de opacidad. Crece suavemente a 100% al llegar al cliente 3 u 4.
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
                            <div className="backdrop-blur-2xl bg-slate-900/90 dark:bg-slate-950/90 border border-slate-700/60 dark:border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_20px_rgba(59,130,246,0.15)] group-hover:!opacity-100 rounded-full px-3.5 py-2 flex items-center gap-2 sm:gap-3 text-slate-900 dark:text-white transition-all duration-300">
                                
                                {/* Selector de Modo (Mensual / Semestral / Renta) */}
                                <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-white/5 p-1 rounded-full border border-slate-200/50 dark:border-white/10">
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
                                                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 ${
                                                    isActive
                                                        ? 'bg-primary text-white shadow-lg shadow-primary/40 scale-[1.03]'
                                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10'
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
                                <div className="h-5 w-px bg-slate-300/60 dark:bg-white/15 hidden sm:block" />

                                {/* Buscador Rápido Flotante */}
                                <div className="relative flex-1 min-w-[110px] max-w-[170px] sm:max-w-[200px]">
                                    <LucideIcons.Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar cliente..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-6 py-1.5 bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 focus:bg-white dark:focus:bg-slate-900 border border-slate-200/50 dark:border-white/10 focus:border-primary/50 rounded-full text-[11px] font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 dark:hover:text-white">
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
                                        className="p-2 rounded-full bg-primary/10 dark:bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/20 dark:border-primary/30 transition-all duration-300 shadow-sm hover:scale-110 active:scale-95 shrink-0"
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
                                        className="p-2 rounded-full bg-slate-100/80 dark:bg-white/5 hover:bg-primary text-slate-600 dark:text-slate-300 hover:text-white border border-slate-200/60 dark:border-white/10 hover:border-primary transition-all duration-300 shadow-sm hover:scale-110 active:scale-95 shrink-0"
                                        title="Bajar al final de la Matriz (Scroll to Bottom)"
                                    >
                                        <LucideIcons.ArrowDown size={14} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* Total Clientes Badge */}
                                <span className="hidden md:inline-flex px-2.5 py-1 rounded-full bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400">
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
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                                    <LucideIcons.FileCheck size={22} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Comprobante Registrado</h3>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{postUploadModal.client.tradeName || postUploadModal.client.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPostUploadModal(null)}
                                className="p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-all"
                            >
                                <LucideIcons.X size={16} />
                            </button>
                        </div>

                        <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/5 space-y-2 text-xs">
                            <div className="flex justify-between text-slate-300">
                                <span className="text-slate-400">Obligación:</span>
                                <span className="font-bold text-white uppercase">{postUploadModal.obType} - {formatPeriodForDisplay(postUploadModal.period)}</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <span className="text-slate-400">Estado Notificación:</span>
                                <span className="text-amber-400 font-bold uppercase">Pendiente de avisar</span>
                            </div>
                        </div>

                        <div className="space-y-2.5 pt-1">
                            {/* Acción 1: Notificar por WhatsApp de una vez */}
                            <button
                                onClick={() => {
                                    const modalData = postUploadModal;
                                    setPostUploadModal(null);
                                    handleSendWhatsAppNotification(modalData.client, modalData.period, modalData.obType, modalData.declaration);
                                }}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
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
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
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
                                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
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
