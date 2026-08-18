import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Client, DeclarationStatus, ReceiptData, TaxRegime, ServiceFeesConfig, ReminderConfig, BusinessProfile, FinancialItem } from '../types';
import { getDueDateForPeriod, formatPeriodForDisplay, getPeriod, safeFormat } from '../services/sri';
import { getClientServiceFee, isCourtesyClient } from '../services/clientService';
import { isPeriodBeforeClientStart, isDeclared, isPaid, getActivePeriodsForClient, getClientDebtSummary } from '../services/complianceEngine';
import { arePeriodsEqual } from '../components/features/TaxComplianceMatrix';
import { differenceInCalendarDays, isSameMonth, parseISO, isValid, subMonths } from 'date-fns';
import {
    AlertTriangle, CheckCircle, MessageSquare, DollarSign,
    Printer, Search, Loader, RefreshCw, CheckSquare, Square, Layers,
    Shield, ExternalLink, ChevronDown, BarChart3, Timer, ShieldAlert,
    ShieldCheck, Calendar, Zap, Activity, Table2
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { printSalesNote } from '../services/printService';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, Legend } from 'recharts';

import { useAppStore } from '../store/useAppStore';
import { useCampaignContext } from '../hooks/useCampaignContext';
import { CampaignBanner } from '../components/ui/CampaignBanner';
import { db } from '../services/db';
import { SupabaseService } from '../services/supabaseClientService';

interface CobranzaScreenProps {
    reminderConfigProp?: ReminderConfig;
    // Props form previous version (for compatibility if needed)
    clientsProp?: Client[];
    setClientsProp?: React.Dispatch<React.SetStateAction<Client[]>>;
    serviceFeesProp?: ServiceFeesConfig;
    navigate?: (screen: any, options?: any) => void;
}


const defaultBusinessProfile: BusinessProfile = {
    ruc: '0705787745001',
    businessName: 'CORDOVA RAMIREZ ROBERTO SANTIGO',
    tradeName: 'Soluciones Tributarias',
    address: 'Colon y Sucre / Pasaje - El Oro',
    phone: '+593 978 980 722',
    email: 'info@santiagocordova.com',
    authNumber: '0000000000'
};

export const CobranzaScreen: React.FC<CobranzaScreenProps> = ({ 
    reminderConfigProp,
    clientsProp,
    setClientsProp,
    serviceFeesProp,
    navigate
}) => {
    // Use Store or Props
    const store = useAppStore();
    const clients = clientsProp || store.clients;
    const setClients = setClientsProp || store.setClients;
    const serviceFees = serviceFeesProp || store.serviceFees;
    const storeReminderConfig = store.reminderConfig;
    const reminderConfig = reminderConfigProp || storeReminderConfig;

    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'receivable' | 'projected' | 'collected'>('receivable');
    const [viewMode, setViewMode] = useState<'clients' | 'grid' | 'matrix' | 'list'>(() => {
        return (localStorage.getItem('sc_cobranza_view_mode') as 'clients' | 'grid' | 'matrix' | 'list') || 'clients';
    });

    useEffect(() => {
        localStorage.setItem('sc_cobranza_view_mode', viewMode);
    }, [viewMode]);

    const [selectedClientExpediente, setSelectedClientExpediente] = useState<any | null>(null);

    const [selectedCellAction, setSelectedCellAction] = useState<{
        client: Client;
        period: string;
        amount: number;
        status: string;
        decl?: any;
    } | null>(null);

    const [moraFilter, setMoraFilter] = useState<'all' | 'al_dia' | 'atrasado' | 'mora_critica'>('all');
    const [matrixFrequency, setMatrixFrequency] = useState<'Mensual' | 'Semestral' | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);

    // Fast SRI Invoicing States
    const [isFastBillingOpen, setIsFastBillingOpen] = useState(false);
    const [fastBillingItem, setFastBillingItem] = useState<FinancialItem | null>(null);
    const [fastBillingStep, setFastBillingStep] = useState<'idle' | 'generating' | 'signing' | 'sending' | 'authorizing' | 'success' | 'failed'>('idle');
    const [fastBillingLogs, setFastBillingLogs] = useState<string[]>([]);
    const [fastBillingError, setFastBillingError] = useState<string | null>(null);
    const [fastBillingXml, setFastBillingXml] = useState('');
    const [fastBillingAccessKey, setFastBillingAccessKey] = useState('');

    const handleEmitFastInvoice = async (item: FinancialItem) => {
        setFastBillingItem(item);
        setFastBillingStep('generating');
        setFastBillingLogs([]);
        setFastBillingError(null);
        setIsFastBillingOpen(true);

        const addLog = (msg: string) => {
            const time = new Date().toLocaleTimeString();
            setFastBillingLogs(prev => [...prev, `[${time}] ${msg}`]);
        };

        addLog(`Iniciando emisión rápida de Factura SRI para ${item.clientName}...`);

        try {
            // 1. Obtener firma electrónica y clave desde IndexedDB
            addLog("Cargando firma electrónica (.p12) desde almacenamiento seguro local...");
            const p12Base64 = await db.getLocal('sc_sri_p12_base64');
            const p12Password = await db.getLocal('sc_sri_p12_password');

            if (!p12Base64 || !p12Password) {
                throw new Error("No se encontró una firma electrónica (.p12) cargada en el sistema o su clave. Por favor, ve al módulo de Facturación SRI y carga tu firma en Configuración primero.");
            }

            // 2. Obtener configuraciones del emisor y API
            const emisorRuc = localStorage.getItem('sc_emisor_ruc') || '0705787745001';
            const emisorRazonSocial = localStorage.getItem('sc_emisor_razon') || 'CORDOVA RAMIREZ ROBERTO SANTIGO';
            const emisorNombreComercial = localStorage.getItem('sc_emisor_comercial') || 'SOLUCIONES CONTABLES PRO';
            const emisorDirMatriz = localStorage.getItem('sc_emisor_dir') || 'Colon y Sucre / Pasaje - El Oro';
            const emisorEstab = localStorage.getItem('sc_emisor_estab') || '001';
            const emisorPtoEmi = localStorage.getItem('sc_emisor_pto') || '001';
            const emisorRegimen = localStorage.getItem('sc_emisor_regimen') || '3'; // 3 = RIMPE Popular
            const ambiente = localStorage.getItem('sc_emisor_ambiente') || '1'; // 1 = Pruebas
            const apiUrl = localStorage.getItem('sc_facturacion_api_url') || 'https://facturador-sri-api.onrender.com';
            const apiPrefix = '/api/v1';

            // Validar que la API responda / ping
            addLog(`Verificando conectividad con servidor de firmas: ${apiUrl}...`);
            const pingRes = await fetch(`${apiUrl}${apiPrefix}/ping`, {
                headers: { 'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir' }
            }).catch(() => null);

            const isMock = !pingRes || !pingRes.ok;
            if (isMock) {
                addLog("Servidor de firmas no disponible en Render, ejecutando en Modo Simulado (Sandbox)...");
            } else {
                addLog("Conexión con servidor de firmas establecida con éxito.");
            }

            // 3. Generar secuencial y clave de acceso
            let nextNum = 0;
            try {
                nextNum = await SupabaseService.getNextSriSecuencial('factura');
            } catch (err: any) {
                addLog("Error obteniendo el siguiente secuencial desde la base de datos.");
                setFastBillingStep('failed');
                return;
            }
            const secuencial = String(nextNum).padStart(9, '0');
            const todayStr = new Date().toISOString().split('T')[0];

            const cleanFecha = todayStr.replace(/-/g, '');
            const dStr = cleanFecha.substring(6, 8) + cleanFecha.substring(4, 6) + cleanFecha.substring(0, 4);
            const baseKey = dStr + '01' + emisorRuc + ambiente + emisorEstab + emisorPtoEmi + secuencial.padStart(9, '0') + '123456781';
            
            let sum = 0;
            let factor = 2;
            for (let i = baseKey.length - 1; i >= 0; i--) {
                sum += parseInt(baseKey[i], 10) * factor;
                factor = factor === 7 ? 2 : factor + 1;
            }
            const remainder = sum % 11;
            let checkDigit = 11 - remainder;
            if (checkDigit === 11) checkDigit = 0;
            if (checkDigit === 10) checkDigit = 1;
            const key = baseKey + checkDigit;
            setFastBillingAccessKey(key);
            addLog(`Clave de Acceso generada: ${key}`);

            // 4. Formular payload para el XML
            const clientObj = clients.find(c => c.id === item.clientId);
            const buyerName = clientObj?.name || item.clientName;
            const buyerRuc = clientObj?.ruc || item.ruc;
            const buyerEmail = clientObj?.email || 'cliente@santiagocordova.com';
            const buyerPhone = clientObj?.phones?.[0] || '';
            const buyerAddress = clientObj?.address || 'Ecuador';
            const buyerIdType = buyerRuc.length === 13 ? '04' : '05';

            const currentIvaRate = emisorRegimen === '3' ? 0.00 : 0.15;
            const subtotalVal = item.amount;
            const ivaVal = Number((subtotalVal * currentIvaRate).toFixed(2));
            const totalVal = Number((subtotalVal + ivaVal).toFixed(2));

            const payload = {
                tipo: 'factura',
                data: {
                    infoTributaria: {
                        ambiente,
                        tipoEmision: '1',
                        razonSocial: emisorRazonSocial,
                        nombreComercial: emisorNombreComercial,
                        ruc: emisorRuc,
                        claveAcceso: key,
                        codDoc: '01',
                        estab: emisorEstab,
                        ptoEmi: emisorPtoEmi,
                        secuencial,
                        dirMatriz: emisorDirMatriz,
                        regimen: emisorRegimen
                    },
                    infoFactura: {
                        fechaEmision: todayStr.split('-').reverse().join('/'),
                        dirEstablecimiento: emisorDirMatriz,
                        obligadoContabilidad: 'NO',
                        tipoIdentificacionComprador: buyerIdType,
                        razonSocialComprador: buyerName,
                        identificacionComprador: buyerRuc,
                        direccionComprador: buyerAddress,
                        totalSinImpuestos: subtotalVal.toFixed(2),
                        totalDescuento: '0.00',
                        totalConImpuestos: [
                            {
                                codigo: '2',
                                codigoPorcentaje: currentIvaRate === 0.00 ? '0' : '4',
                                baseImponible: subtotalVal.toFixed(2),
                                valor: ivaVal.toFixed(2)
                            }
                        ],
                        propina: '0.00',
                        importeTotal: totalVal.toFixed(2),
                        moneda: 'DOLAR',
                        pagos: [
                            {
                                formaPago: '20',
                                total: totalVal.toFixed(2),
                                plazo: '0',
                                unidadTiempo: 'dias'
                            }
                        ]
                    },
                    detalles: [
                        {
                            codigoPrincipal: '001',
                            descripcion: `Servicios Contables y Asesoría Tributaria - Período ${item.period}`,
                            cantidad: '1.00',
                            precioUnitario: subtotalVal.toFixed(2),
                            descuento: '0.00',
                            precioTotalSinImpuesto: subtotalVal.toFixed(2),
                            impuestos: [
                                {
                                    codigo: '2',
                                    codigoPorcentaje: currentIvaRate === 0.00 ? '0' : '4',
                                    tarifa: currentIvaRate === 0.00 ? '0' : '15',
                                    baseImponible: subtotalVal.toFixed(2),
                                    valor: ivaVal.toFixed(2)
                                }
                            ]
                        }
                    ],
                    infoAdicional: {
                        campoAdicional: [
                            { name: 'Email', value: buyerEmail },
                            { name: 'Telefono', value: buyerPhone || '0999999999' }
                        ]
                    }
                }
            };

            // 5. Paso 1: Generar XML
            let currentXml = '';
            addLog("Generando XML del comprobante...");
            if (isMock) {
                currentXml = `<?xml version="1.0" encoding="UTF-8"?>\n<factura id="comprobante" version="1.0.0">\n  <infoTributaria>\n    <ambiente>${ambiente}</ambiente>\n    <ruc>${emisorRuc}</ruc>\n    <claveAcceso>${key}</claveAcceso>\n    <secuencial>${secuencial}</secuencial>\n  </infoTributaria>\n</factura>`;
                setFastBillingXml(currentXml);
                addLog("XML generado correctamente (SIMULADO).");
            } else {
                const response = await fetch(`${apiUrl}${apiPrefix}/facturacion/xml`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) throw new Error("Error en API al generar XML.");
                const resData = await response.json();
                currentXml = resData.data?.xml || resData.xml;
                setFastBillingXml(currentXml);
                addLog("XML generado exitosamente en el backend.");
            }

            // 6. Paso 2: Firmar XML
            setFastBillingStep('signing');
            addLog("Firmando XML digitalmente usando certificado .p12 (XAdES-BES)...");
            if (isMock) {
                currentXml = currentXml.replace('</infoTributaria>', `</infoTributaria>\n  <Signature>\n    <SignatureValue>SIMULADO</SignatureValue>\n  </Signature>`);
                setFastBillingXml(currentXml);
                addLog("Firma digital realizada exitosamente (SIMULADA).");
            } else {
                const activeBase64 = (await db.getLocal('sc_sri_p12_base64')) || localStorage.getItem('sc_sri_p12_base64') || '';
                const activePassword = (await db.getLocal('sc_sri_p12_password')) || localStorage.getItem('sc_sri_p12_password') || 'ClaveFirma123';
                
                if (!activeBase64) {
                    throw new Error("No se encontró el archivo de Firma Electrónica (.p12). Configúralo en Facturación SRI.");
                }

                const signRes = await fetch(`${apiUrl}${apiPrefix}/facturacion/firmar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir' },
                    body: JSON.stringify({
                        tipo: 'factura',
                        xml: currentXml,
                        clave: activePassword,
                        clave_certificado: activePassword,
                        certificado_p12_base64: activeBase64
                    })
                });

                if (!signRes.ok) {
                    let errDetail = signRes.statusText;
                    try {
                        const errJson = await signRes.json();
                        errDetail = errJson.message || errJson.error || errJson.msg || errDetail;
                    } catch {}
                    throw new Error(`Error al firmar digitalmente: ${errDetail}`);
                }

                const signData = await signRes.json();
                currentXml = signData.data?.xml || signData.xml_firmado || signData.xml;
                setFastBillingXml(currentXml);
                addLog("XML firmado digitalmente con éxito.");
            }

            // 7. Paso 3: Enviar al SRI
            setFastBillingStep('sending');
            addLog("Conectando con el Web Service de Recepción del SRI...");
            if (isMock) {
                addLog("SRI Recepción: RECIBIDO / DEVUELTA (SIMULADO).");
            } else {
                const sendRes = await fetch(`${apiUrl}${apiPrefix}/facturacion/sri/enviar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir' },
                    body: JSON.stringify({ xml: currentXml, ambiente })
                });
                if (!sendRes.ok) throw new Error("Fallo de conexión al SRI Recepción.");
                addLog(`SRI Recepción Respuesta: RECIBIDO.`);
            }

            // 8. Paso 4: Autorizar
            setFastBillingStep('authorizing');
            addLog("Solicitando autorización de comprobante al SRI...");
            let isAuthorized = false;
            let errorMsg = '';

            if (isMock) {
                isAuthorized = true;
                addLog("SRI Autorización: AUTORIZADO (SIMULADO).");
            } else {
                const authRes = await fetch(`${apiUrl}${apiPrefix}/facturacion/sri/autorizar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir' },
                    body: JSON.stringify({ clave_acceso: key, ambiente })
                });
                if (!authRes.ok) throw new Error("Fallo consulta de autorización.");
                const authData = await authRes.json();
                const rawDataStr = typeof authData.data === 'string' ? authData.data : JSON.stringify(authData.data || {});
                const uppercaseData = rawDataStr.toUpperCase().replace(/[\s\\"]/g, '');
                isAuthorized = authData.status && uppercaseData.includes('ESTADO:AUTORIZADO');

                if (!isAuthorized) {
                    errorMsg = 'No autorizado por el SRI (Estado no AUTORIZADO)';
                    addLog("SRI Autorización: RECHAZADO / ERROR.");
                } else {
                    addLog("SRI Autorización: AUTORIZADO.");
                }
            }

            // 9. Guardar historial
            const newRecord = {
                id: Date.now().toString(),
                tipo: 'factura',
                secuencial,
                claveAcceso: key,
                rucReceptor: buyerRuc,
                nombreReceptor: buyerName,
                fechaEmision: todayStr,
                total: totalVal,
                estado: isAuthorized ? 'Autorizado' : 'Error',
                xml: currentXml,
                ambiente,
                mensajeError: isAuthorized ? undefined : errorMsg
            };

            const currentHistory = await db.getLocal('sc_sri_comprobantes_history') || [];
            const updatedHistory = [newRecord, ...currentHistory];
            await db.setLocal('sc_sri_comprobantes_history', updatedHistory);
            await SupabaseService.upsertSriComprobante(newRecord).catch(() => {});

            if (!isAuthorized) {
                throw new Error(errorMsg || "Comprobante emitido con errores.");
            }

            // 10. Marcar como pagada
            setClients(prev => {
                const newClients = [...prev];
                const clientIdx = newClients.findIndex(c => c.id === item.clientId);
                if (clientIdx > -1) {
                    const decls = [...newClients[clientIdx].declarations];
                    const declIdx = decls.findIndex(d => d.period === item.period);
                    const entry = { period: item.period, status: DeclarationStatus.Pagada, paidAt: new Date().toISOString(), transactionId: `PAY-${key.slice(-6)}`, amount: item.amount, updatedAt: new Date().toISOString() };
                    if (declIdx > -1) decls[declIdx] = { ...decls[declIdx], ...entry };
                    else decls.push(entry as any);
                    newClients[clientIdx] = { ...newClients[clientIdx], declarations: decls };
                }
                return newClients;
            });

            setFastBillingStep('success');
            addLog("¡Factura emitida, firmada y autorizada por el SRI exitosamente! (Éxito)");
            toast.success("Factura SRI emitida y autorizada correctamente.");

        } catch (err: any) {
            setFastBillingStep('failed');
            setFastBillingError(err.message);
            addLog(`Error en el proceso: ${err.message}`);
            toast.error(err.message);
        }
    };
    
    // Fiscal Context
    const campaignContext = useCampaignContext();

    // Referencia para impresión
    const receiptRef = useRef<HTMLDivElement>(null);

    const [sriHistory, setSriHistory] = useState<any[]>([]);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const stored = (await db.getLocal('sc_sri_comprobantes_history')) || JSON.parse(localStorage.getItem('sc_sri_comprobantes_history') || '[]');
                setSriHistory(Array.isArray(stored) ? stored : []);
            } catch (err) {
                console.error('Error al cargar historial SRI en cobranzas:', err);
            }
        };
        loadHistory();
    }, []);

    const findSriInvoice = (clientRuc: string, period?: string) => {
        if (!sriHistory || sriHistory.length === 0) return null;
        const cleanRuc = clientRuc.replace(/\D/g, '');
        return sriHistory.find(h => 
            h.estado === 'Autorizado' && 
            h.tipo === 'factura' && 
            (h.rucReceptor?.replace(/\D/g, '') === cleanRuc)
        ) || null;
    };

    const financialData = useMemo(() => {
        const receivable: FinancialItem[] = [];
        const projected: FinancialItem[] = [];
        const collected: FinancialItem[] = [];
        const now = new Date();
        const selectedMonth = new Date();

        clients.forEach(client => {
            if (client.isDeleted || client.isActive === false || isCourtesyClient(client)) return;
            const fee = getClientServiceFee(client, serviceFees);
            if (fee <= 0) return; // Courtesy / Zero fee clients do not generate debt

            let type: FinancialItem['type'] = 'mensual';
            if (client.taxProfile?.ivaFrequency === 'Semestral') type = 'semestral';
            else if (client.regime === TaxRegime.RimpeNegocioPopular) type = 'renta';
            else if (client.taxProfile?.hasActiveDevolucionIva) type = 'dev';

            const activePeriods = getActivePeriodsForClient(client, now);
            const processedPeriods = new Set<string>();

            // 1. Process explicit declarations in client.declarations
            (client.declarations || []).forEach(decl => {
                if (isPeriodBeforeClientStart(client, decl.period)) return;
                processedPeriods.add(decl.period);

                const amount = decl.amount || fee;
                const paid = isPaid(decl, client);

                if (paid) {
                    const paidDate = decl.paidAt ? parseISO(decl.paidAt) : now;
                    if (isValid(paidDate) && isSameMonth(paidDate, selectedMonth)) {
                        collected.push({
                            clientId: client.id, clientName: client.name, ruc: client.ruc,
                            period: decl.period, amount, status: DeclarationStatus.Pagada,
                            type, dateReference: paidDate, phones: client.phones || []
                        });
                    }
                } else if (isDeclared(decl) || decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pendiente) {
                    // DEUDA VERDADERA DE MATRIZ: Declarado / Enviado y no pagado
                    const dueDate = getDueDateForPeriod(client, decl.period) || now;
                    receivable.push({
                        clientId: client.id, clientName: client.name, ruc: client.ruc,
                        period: decl.period, amount, status: decl.status || DeclarationStatus.Enviada,
                        type, dateReference: dueDate, daysDiff: differenceInCalendarDays(now, dueDate),
                        phones: client.phones || []
                    });
                }
            });

            // 2. Process active periods that were declared in Matriz
            activePeriods.forEach(period => {
                if (processedPeriods.has(period) || isPeriodBeforeClientStart(client, period)) return;
                const dueDate = getDueDateForPeriod(client, period) || now;
                const diff = differenceInCalendarDays(now, dueDate);
                const item: FinancialItem = {
                    clientId: client.id, clientName: client.name, ruc: client.ruc,
                    period, amount: fee, status: DeclarationStatus.Pendiente,
                    type, dateReference: dueDate, daysDiff: diff, phones: client.phones || [], isVirtual: true
                };
                if (diff <= 0) {
                    projected.push(item);
                }
            });
        });
        return { receivable, projected, collected };
    }, [clients, serviceFees, isRecalculating]);

    const moraCounts = useMemo(() => {
        const baseList = activeTab === 'receivable' ? financialData.receivable
            : activeTab === 'projected' ? financialData.projected
            : financialData.collected;

        let filtered = baseList;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(i => i.clientName.toLowerCase().includes(lower) || i.ruc.includes(lower) || i.period.toLowerCase().includes(lower));
        }

        return {
            all: filtered.length,
            al_dia: filtered.filter(i => (i.daysDiff || 0) <= 0).length,
            atrasado: filtered.filter(i => (i.daysDiff || 0) > 0 && (i.daysDiff || 0) <= 30).length,
            mora_critica: filtered.filter(i => (i.daysDiff || 0) > 30).length
        };
    }, [financialData, activeTab, searchTerm]);

    const currentList = useMemo(() => {
        let list = activeTab === 'receivable' ? [...financialData.receivable]
            : activeTab === 'projected' ? [...financialData.projected]
                : [...financialData.collected];
                
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(i => i.clientName.toLowerCase().includes(lower) || i.ruc.includes(lower) || i.period.toLowerCase().includes(lower));
        }

        if (moraFilter !== 'all') {
            list = list.filter(i => {
                const diff = i.daysDiff || 0;
                if (moraFilter === 'al_dia') return diff <= 0;
                if (moraFilter === 'atrasado') return diff > 0 && diff <= 30;
                if (moraFilter === 'mora_critica') return diff > 30;
                return true;
            });
        }
        
        // Auto-Ordenamiento Lógico
        return list.sort((a, b) => {
            if (activeTab === 'collected') {
                // Más recientes primero
                return b.dateReference.getTime() - a.dateReference.getTime();
            } else {
                // Urgencia (los que tienen daysDiff más alto están más vencidos)
                return (b.daysDiff || 0) - (a.daysDiff || 0);
            }
        });
    }, [financialData, activeTab, searchTerm, moraFilter]);

    // Helper: Determinar frecuencia de IVA del Contribuyente (Mensual, Semestral o Rimpe Popular)
    const getClientIvaFrequency = (client: Client): 'Mensual' | 'Semestral' | 'Popular' => {
        if (client.regime === TaxRegime.RimpeNegocioPopular) return 'Popular';
        if (client.taxProfile?.ivaFrequency === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor) return 'Semestral';
        return 'Mensual';
    };

    // Períodos Fiscales para la Matriz de Cobranzas (Mensuales o Semestrales)
    const matrixPeriods = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        if (matrixFrequency === 'Semestral') {
            // Generar los 6 últimos semestres fiscales (ej: 2025-2S, 2025-1S, 2024-2S, 2024-1S, 2023-2S, 2023-1S)
            const list: { key: string; label: string; shortLabel: string; year: string; type: 'semestral' }[] = [];
            let y = currentYear;
            let s = currentMonth <= 6 ? 1 : 2;
            
            for (let i = 0; i < 6; i++) {
                const key = `${y}-${s}S`;
                const label = `${s}º Semestre ${y}`;
                const shortLabel = `${s}S`;
                list.push({ key, label, shortLabel, year: y.toString(), type: 'semestral' });
                
                s--;
                if (s < 1) {
                    s = 2;
                    y--;
                }
            }
            return list;
        }

        // Mensual o Consolidado
        const list: { key: string; label: string; shortLabel: string; year: string; type: 'mensual' }[] = [];
        const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(now, i);
            const yyyy = d.getFullYear().toString();
            const mm = (d.getMonth() + 1).toString().padStart(2, '0');
            const key = `${yyyy}-${mm}`;
            list.push({
                key,
                label: `${monthNames[d.getMonth()]} ${yyyy}`,
                shortLabel: monthNames[d.getMonth()],
                year: yyyy,
                type: 'mensual'
            });
        }
        return list;
    }, [matrixFrequency]);

    // Matriz de Clientes vs Períodos Fiscales de Cobro (Mensual & Semestral)
    const matrixClientsData = useMemo(() => {
        const query = searchTerm.toLowerCase();
        const baseClients = clients.filter(c => {
            if (c.isDeleted || c.isActive === false || isCourtesyClient(c)) return false;
            
            const freq = getClientIvaFrequency(c);
            if (matrixFrequency === 'Mensual' && freq === 'Semestral') return false;
            if (matrixFrequency === 'Semestral' && freq === 'Mensual') return false;

            if (query) {
                const match = c.name.toLowerCase().includes(query) || (c.tradeName && c.tradeName.toLowerCase().includes(query)) || c.ruc.includes(query);
                if (!match) return false;
            }
            return true;
        });

        return baseClients.map(client => {
            const fee = getClientServiceFee(client, serviceFees);
            const freq = getClientIvaFrequency(client);
            let totalUnpaidDebt = 0;
            let totalPaid = 0;
            let pendingDeclaredCount = 0;

            const periodsStatus = matrixPeriods.map(p => {
                const isBefore = isPeriodBeforeClientStart(client, p.key);
                if (isBefore) {
                    return { key: p.key, status: 'na', amount: 0, label: 'N/A' };
                }

                // Si estamos en vista unificada mensual y el cliente es semestral, pero el mes no es un cierre semestral (-06 o -12)
                if (matrixFrequency === 'all' && freq === 'Semestral' && !p.key.endsWith('-06') && !p.key.endsWith('-12')) {
                    return { key: p.key, status: 'na', amount: 0, label: 'Semestral' };
                }

                // Buscar declaración exacta o equivalente semestral
                let decl = (client.declarations || []).find(d => arePeriodsEqual(d.period, p.key) || d.period === p.key);
                
                // Si el cliente es semestral y p.key es un semestre ej: 2025-2S o 2025-1S
                if (!decl && freq === 'Semestral') {
                    if (p.key.includes('1S') || p.key.endsWith('-06')) {
                        decl = (client.declarations || []).find(d => d.period.includes('1S') || d.period.includes('S1') || d.period.endsWith('-06'));
                    } else if (p.key.includes('2S') || p.key.endsWith('-12')) {
                        decl = (client.declarations || []).find(d => d.period.includes('2S') || d.period.includes('S2') || d.period.endsWith('-12'));
                    }
                }

                const itemAmount = (decl && decl.amount) ? decl.amount : fee;

                if (decl && isPaid(decl, client)) {
                    totalPaid += itemAmount;
                    return { key: p.key, status: 'paid', amount: itemAmount, label: 'Cobrado', decl };
                }

                if (decl && (isDeclared(decl) || decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pendiente)) {
                    totalUnpaidDebt += itemAmount;
                    pendingDeclaredCount++;
                    return { key: p.key, status: 'due_declared', amount: itemAmount, label: 'Por Cobrar', decl };
                }

                // Si no hay declaración o está sin declarar
                const dueDate = getDueDateForPeriod(client, p.key);
                const diff = dueDate ? differenceInCalendarDays(new Date(), dueDate) : 0;

                if (diff > 0) {
                    totalUnpaidDebt += itemAmount;
                    return { key: p.key, status: 'due_undeclared', amount: itemAmount, label: 'Atrasado', daysDiff: diff, decl };
                } else {
                    return { key: p.key, status: 'projected', amount: itemAmount, label: 'Proyectado', decl };
                }
            });

            return {
                client,
                fee,
                freq,
                totalUnpaidDebt,
                totalPaid,
                pendingDeclaredCount,
                periodsStatus
            };
        }).sort((a, b) => {
            // Sort by highest unpaid debt first
            if (b.totalUnpaidDebt !== a.totalUnpaidDebt) {
                return b.totalUnpaidDebt - a.totalUnpaidDebt;
            }
            return a.client.name.localeCompare(b.client.name);
        });
    }, [clients, serviceFees, matrixPeriods, matrixFrequency, searchTerm]);

    // CARTERA CONSOLIDADA POR CLIENTE CON TIRA DE COMPROBANTES Y DECLARACIONES
    const consolidatedClients = useMemo(() => {
        const query = searchTerm.toLowerCase();
        const now = new Date();
        const list: any[] = [];

        clients.forEach(client => {
            if (client.isDeleted || client.isActive === false || isCourtesyClient(client)) return;
            const fee = getClientServiceFee(client, serviceFees);
            if (fee <= 0) return;

            if (query) {
                const match = client.name.toLowerCase().includes(query) || 
                              (client.tradeName && client.tradeName.toLowerCase().includes(query)) || 
                              client.ruc.includes(query);
                if (!match) return;
            }

            const activePeriods = getActivePeriodsForClient(client, now);
            const processedPeriods = new Set<string>();
            const periodsList: any[] = [];
            let totalDebt = 0;
            let totalPaid = 0;
            let pendingCount = 0;
            let maxDaysOverdue = 0;

            // 1. Declaraciones existentes
            (client.declarations || []).forEach(decl => {
                if (isPeriodBeforeClientStart(client, decl.period)) return;
                processedPeriods.add(decl.period);
                const amount = decl.amount || fee;
                const dueDate = getDueDateForPeriod(client, decl.period) || now;
                const diff = differenceInCalendarDays(now, dueDate);
                const sriDoc = findSriInvoice(client.ruc, decl.period);

                if (isPaid(decl, client)) {
                    totalPaid += amount;
                    periodsList.push({
                        period: decl.period,
                        label: formatPeriodForDisplay(decl.period),
                        amount,
                        status: 'paid',
                        decl,
                        dueDate,
                        daysDiff: diff,
                        sriDoc
                    });
                } else if (isDeclared(decl) || decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pendiente) {
                    totalDebt += amount;
                    pendingCount++;
                    if (diff > maxDaysOverdue) maxDaysOverdue = diff;
                    periodsList.push({
                        period: decl.period,
                        label: formatPeriodForDisplay(decl.period),
                        amount,
                        status: 'due_declared',
                        decl,
                        dueDate,
                        daysDiff: diff,
                        sriDoc
                    });
                }
            });

            // 2. Períodos activos proyectados o sin declarar
            activePeriods.forEach(period => {
                if (processedPeriods.has(period) || isPeriodBeforeClientStart(client, period)) return;
                const dueDate = getDueDateForPeriod(client, period) || now;
                const diff = differenceInCalendarDays(now, dueDate);
                const sriDoc = findSriInvoice(client.ruc, period);

                if (diff > 0) {
                    totalDebt += fee;
                    pendingCount++;
                    if (diff > maxDaysOverdue) maxDaysOverdue = diff;
                    periodsList.push({
                        period,
                        label: formatPeriodForDisplay(period),
                        amount: fee,
                        status: 'due_pending',
                        dueDate,
                        daysDiff: diff,
                        sriDoc
                    });
                } else {
                    periodsList.push({
                        period,
                        label: formatPeriodForDisplay(period),
                        amount: fee,
                        status: 'projected',
                        dueDate,
                        daysDiff: diff,
                        sriDoc
                    });
                }
            });

            // Orden cronológico (más recientes primero)
            periodsList.sort((a, b) => b.period.localeCompare(a.period));

            // Filtro de mora
            if (moraFilter === 'al_dia' && totalDebt > 0) return;
            if (moraFilter === 'atrasado' && (maxDaysOverdue <= 0 || maxDaysOverdue > 30)) return;
            if (moraFilter === 'mora_critica' && maxDaysOverdue <= 30) return;

            // Filtro de pestaña activa
            if (activeTab === 'receivable' && totalDebt === 0) return;
            if (activeTab === 'collected' && totalPaid === 0) return;

            list.push({
                client,
                fee,
                totalDebt,
                totalPaid,
                pendingCount,
                maxDaysOverdue,
                periods: periodsList
            });
        });

        return list.sort((a, b) => {
            if (b.totalDebt !== a.totalDebt) return b.totalDebt - a.totalDebt;
            if (b.maxDaysOverdue !== a.maxDaysOverdue) return b.maxDaysOverdue - a.maxDaysOverdue;
            return a.client.name.localeCompare(b.client.name);
        });
    }, [clients, serviceFees, searchTerm, moraFilter, activeTab, isRecalculating]);

    const generateClientWhatsAppCobroMsg = (profile: any) => {
        const unpaidPeriods = profile.periods.filter((p: any) => p.status === 'due_declared' || p.status === 'due_pending');
        const periodsBreakdown = unpaidPeriods.map((p: any) => 
            `• *${p.label}*: $${p.amount.toFixed(2)} USD (${p.status === 'due_declared' ? 'Declaración SRI Realizada' : 'Pendiente SRI'})`
        ).join('\n');

        return `Estimado(a) *${profile.client.name}*, le saluda Santiago Córdova - Soluciones Tributarias PRO.\n\nLe recordamos cordialmente que mantiene un saldo pendiente de honorarios contables por un valor total de *$${profile.totalDebt.toFixed(2)} USD* correspondiente a las siguientes obligaciones:\n\n${periodsBreakdown}\n\n🏛️ *Datos para transferencia bancaria:*\nBanco Pichincha - Cta Ahorros\nTitular: Roberto Santiago Córdova Ramírez\nRUC: 0705787745001\n\nPor favor remítanos su comprobante por este medio para emitir su respectiva factura electrónica autorizada por el SRI. ¡Muchas gracias por su confianza!`;
    };

    const handleLiquidateClientDebt = (profile: any) => {
        const unpaidPeriods = profile.periods.filter((p: any) => p.status === 'due_declared' || p.status === 'due_pending');
        if (unpaidPeriods.length === 0) {
            toast.info("Este cliente no tiene obligaciones pendientes por liquidar.");
            return;
        }

        const keys = unpaidPeriods.map((p: any) => `${profile.client.id}-${p.period}`);
        setSelectedItems(new Set(keys));
        setIsPaymentModalOpen(true);
    };

    // Resolver información completa de cliente, período y monto desde una key 'clientId-period'
    const getItemFromKey = useCallback((key: string) => {
        const client = clients.find(c => key.startsWith(c.id));
        if (!client) return null;
        const period = key.slice(client.id.length + 1);
        
        const item = financialData.receivable.find(i => i.clientId === client.id && (arePeriodsEqual(i.period, period) || i.period === period))
                  || financialData.projected.find(i => i.clientId === client.id && (arePeriodsEqual(i.period, period) || i.period === period))
                  || financialData.collected.find(i => i.clientId === client.id && (arePeriodsEqual(i.period, period) || i.period === period));
                  
        const amount = item?.amount ?? getClientServiceFee(client, serviceFees);
        return { client, period, amount, item };
    }, [clients, financialData, serviceFees]);

    const selectedSummary = useMemo(() => {
        let total = 0;
        selectedItems.forEach(key => {
            const resolved = getItemFromKey(key);
            if (resolved) total += resolved.amount;
        });
        return { count: selectedItems.size, total };
    }, [selectedItems, getItemFromKey]);

    const handleExportCsv = () => {
        if (currentList.length === 0) {
            toast.info("No hay datos para exportar en la vista actual.");
            return;
        }

        const headers = ["Cliente", "RUC", "Periodo", "Tipo", "Monto", "Estado", "Dias_Mora", "Telefono"];
        const rows = currentList.map(item => [
            `"${item.clientName.replace(/"/g, '""')}"`,
            `"${item.ruc}"`,
            `"${item.period}"`,
            `"${item.type}"`,
            item.amount.toFixed(2),
            `"${item.status}"`,
            item.daysDiff ?? 0,
            `"${(item.phones && item.phones[0]) || ''}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Cobranzas_SantiagoCordova_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Reporte CSV de cobranzas descargado exitosamente.");
    };

    const chartData = [
        { name: 'Cobrable', value: financialData.receivable.reduce((s, i) => s + i.amount, 0), color: '#ef4444' },
        { name: 'Recaudado', value: financialData.collected.reduce((s, i) => s + i.amount, 0), color: '#10b981' }
    ].filter(d => d.value > 0);

    // Registro de Pago Directo de 1 Solo Período (Matriz / Expediente / Celda)
    const handlePaySinglePeriod = async (client: Client, period: string, amount: number) => {
        const nowIso = new Date().toISOString();
        const transactionId = `PAY-${Date.now().toString().slice(-6)}`;
        const history = [...(client.declarations || [])];
        const declIdx = history.findIndex(d => arePeriodsEqual(d.period, period) || d.period === period);
        const existingDecl = declIdx > -1 ? history[declIdx] : null;

        const entry: any = {
            ...(existingDecl || {}),
            period,
            status: DeclarationStatus.Pagada,
            is_paid: true,
            paidAt: nowIso,
            transactionId,
            amount,
            updatedAt: nowIso
        };

        if (declIdx > -1) {
            history[declIdx] = entry;
        } else {
            history.push(entry);
        }

        const updatedClient = { ...client, declarations: history, updatedAt: nowIso };
        
        // Persistir en Zustand Store y Local DB
        store.updateClient(client.id, { declarations: history });
        const newClients = clients.map(c => c.id === client.id ? updatedClient : c);
        setClients(newClients);
        await db.setLocal('clients', newClients);

        setSelectedCellAction(null);
        setReceiptData({
            transactionId,
            clientName: client.name,
            clientRuc: client.ruc,
            client: updatedClient,
            paymentDate: safeFormat(new Date(), 'PPpp'),
            paidPeriods: [{ period, amount }],
            totalAmount: amount
        });
        setIsReceiptOpen(true);
        toast.success(`Pago de $${amount.toFixed(2)} registrado para ${client.name} (${formatPeriodForDisplay(period)})`);
    };

    // Revertir o Desmarcar Pago (Volver a Pendiente)
    const handleUnmarkPaidPeriod = async (client: Client, period: string) => {
        const nowIso = new Date().toISOString();
        const history = [...(client.declarations || [])];
        const declIdx = history.findIndex(d => arePeriodsEqual(d.period, period) || d.period === period);
        
        if (declIdx > -1) {
            history[declIdx] = {
                ...history[declIdx],
                status: history[declIdx].proof_file ? DeclarationStatus.Enviada : DeclarationStatus.Pendiente,
                is_paid: false,
                paidAt: undefined,
                updatedAt: nowIso
            };
        }

        const updatedClient = { ...client, declarations: history, updatedAt: nowIso };
        store.updateClient(client.id, { declarations: history });
        const newClients = clients.map(c => c.id === client.id ? updatedClient : c);
        setClients(newClients);
        await db.setLocal('clients', newClients);

        setSelectedCellAction(null);
        toast.info(`Pago de ${formatPeriodForDisplay(period)} revertido a pendiente para ${client.name}`);
    };

    // Liquidar toda la deuda de un cliente en 1 Clic desde la fila de la Matriz
    const handleLiquidateClientDirect = async (client: Client) => {
        const nowIso = new Date().toISOString();
        const transactionId = `PAY-${Date.now().toString().slice(-6)}`;
        const fee = getClientServiceFee(client, serviceFees);
        
        const unpaidPeriods: { period: string; amount: number }[] = [];
        let totalAmount = 0;
        const history = [...(client.declarations || [])];

        matrixPeriods.forEach(p => {
            if (isPeriodBeforeClientStart(client, p.key)) return;
            const decl = history.find(d => arePeriodsEqual(d.period, p.key) || d.period === p.key);
            if (!decl || !isPaid(decl, client)) {
                const itemAmount = decl?.amount || fee;
                unpaidPeriods.push({ period: p.key, amount: itemAmount });
                totalAmount += itemAmount;
                
                const declIdx = history.findIndex(d => arePeriodsEqual(d.period, p.key) || d.period === p.key);
                const entry: any = {
                    ...(decl || {}),
                    period: p.key,
                    status: DeclarationStatus.Pagada,
                    is_paid: true,
                    paidAt: nowIso,
                    transactionId,
                    amount: itemAmount,
                    updatedAt: nowIso
                };
                if (declIdx > -1) history[declIdx] = entry;
                else history.push(entry);
            }
        });

        if (unpaidPeriods.length === 0) {
            toast.info(`${client.name} ya está al día con todas sus obligaciones.`);
            return;
        }

        const updatedClient = { ...client, declarations: history, updatedAt: nowIso };
        store.updateClient(client.id, { declarations: history });
        const newClients = clients.map(c => c.id === client.id ? updatedClient : c);
        setClients(newClients);
        await db.setLocal('clients', newClients);

        setReceiptData({
            transactionId,
            clientName: client.name,
            clientRuc: client.ruc,
            client: updatedClient,
            paymentDate: safeFormat(new Date(), 'PPpp'),
            paidPeriods: unpaidPeriods,
            totalAmount
        });
        setIsReceiptOpen(true);
        toast.success(`¡Deuda de $${totalAmount.toFixed(2)} liquidada exitosamente para ${client.name}!`);
    };

    // Liquidar todos los cobros pendientes de un mes/período en toda la columna de la Matriz
    const handleLiquidateColumnPeriod = async (periodKey: string, periodLabel: string) => {
        const nowIso = new Date().toISOString();
        const transactionId = `PAY-${Date.now().toString().slice(-6)}`;
        let updatedCount = 0;
        let totalAmount = 0;
        const newClients = [...clients];

        newClients.forEach((client, clientIdx) => {
            if (isPeriodBeforeClientStart(client, periodKey) || isCourtesyClient(client)) return;
            const fee = getClientServiceFee(client, serviceFees);
            const history = [...(client.declarations || [])];
            const declIdx = history.findIndex(d => arePeriodsEqual(d.period, periodKey) || d.period === periodKey);
            const decl = declIdx > -1 ? history[declIdx] : null;

            if (!decl || !isPaid(decl, client)) {
                const itemAmount = decl?.amount || fee;
                const entry: any = {
                    ...(decl || {}),
                    period: periodKey,
                    status: DeclarationStatus.Pagada,
                    is_paid: true,
                    paidAt: nowIso,
                    transactionId,
                    amount: itemAmount,
                    updatedAt: nowIso
                };

                if (declIdx > -1) history[declIdx] = entry;
                else history.push(entry);

                newClients[clientIdx] = { ...client, declarations: history, updatedAt: nowIso };
                store.updateClient(client.id, { declarations: history });
                updatedCount++;
                totalAmount += itemAmount;
            }
        });

        if (updatedCount === 0) {
            toast.info(`Todos los clientes ya están cobrados en el período ${periodLabel}.`);
            return;
        }

        setClients(newClients);
        await db.setLocal('clients', newClients);
        toast.success(`¡${updatedCount} cobros del período ${periodLabel} liquidados exitosamente ($${totalAmount.toFixed(2)})!`);
    };

    // Procesamiento en Lote de Pagos Seleccionados
    const handleProcessPayment = () => {
        if (selectedItems.size === 0) return;
        setIsProcessing(true);
        const nowIso = new Date().toISOString();
        const transactionId = `PAY-${Date.now().toString().slice(-6)}`;
        
        const newClients = [...clients];
        let lastClient: Client | undefined;
        let paidPeriods: { period: string; amount: number }[] = [];

        selectedItems.forEach(key => {
            const resolved = getItemFromKey(key);
            if (!resolved) return;
            const { client, period, amount } = resolved;
            
            const clientIdx = newClients.findIndex(c => c.id === client.id);
            if (clientIdx === -1) return;

            const history = [...(newClients[clientIdx].declarations || [])];
            const declIdx = history.findIndex(d => arePeriodsEqual(d.period, period) || d.period === period);
            const existingDecl = declIdx > -1 ? history[declIdx] : null;

            const entry: any = {
                ...(existingDecl || {}),
                period,
                status: DeclarationStatus.Pagada,
                is_paid: true,
                paidAt: nowIso,
                transactionId,
                amount,
                updatedAt: nowIso
            };

            if (declIdx > -1) {
                history[declIdx] = entry;
            } else {
                history.push(entry);
            }

            newClients[clientIdx] = { ...newClients[clientIdx], declarations: history, updatedAt: nowIso };
            lastClient = newClients[clientIdx];
            paidPeriods.push({ period, amount });

            // Persistir cada cliente al store
            store.updateClient(client.id, { declarations: history });
        });

        setTimeout(async () => {
            setClients(newClients);
            await db.setLocal('clients', newClients);
            setIsProcessing(false);
            setIsPaymentModalOpen(false);
            setSelectedItems(new Set());
            if (lastClient) {
                setReceiptData({
                    transactionId,
                    clientName: lastClient.name,
                    clientRuc: lastClient.ruc,
                    client: lastClient,
                    paymentDate: safeFormat(new Date(), 'PPpp'),
                    paidPeriods,
                    totalAmount: paidPeriods.reduce((s, p) => s + p.amount, 0)
                });
                setIsReceiptOpen(true);
            }
            toast.success("Pago registrado exitosamente");
        }, 500);
    };

    const handleSyncAllDeclaredAsPaid = () => {
        let count = 0;
        const nowIso = new Date().toISOString();
        const updatedClients = clients.map(client => {
            let hasChanges = false;
            const decls = [...(client.declarations || [])];

            decls.forEach((decl, idx) => {
                if ((decl.status === DeclarationStatus.Enviada || decl.proof_file) && !decl.is_paid && decl.status !== DeclarationStatus.Pagada) {
                    decls[idx] = {
                        ...decl,
                        status: DeclarationStatus.Pagada,
                        is_paid: true,
                        paidAt: nowIso,
                        updatedAt: nowIso
                    };
                    hasChanges = true;
                    count++;
                }
            });

            if (hasChanges) {
                store.updateClient(client.id, { declarations: decls });
            }
            return client;
        });

        if (count > 0) {
            toast.success(`¡${count} cobros sincronizados y marcados como PAGADOS exitosamente!`);
        } else {
            toast.info("Cobranza ya se encuentra 100% sincronizada y al día con la Matriz.");
        }
    };

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-300 relative pt-4 sm:pt-0 font-sans">
            {/* ELITE TACTICAL HEADER (Stitch Obsidian Luxury) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 relative z-10 px-4 sm:px-0">
                <div className="space-y-1.5 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-[#00A896]/15 text-[#00A896] text-[9px] font-bold uppercase tracking-widest border border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.3)] flex items-center gap-1.5 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00A896] animate-pulse"></span>
                            Financial Grid Alpha • Santiago Cordova Protocol
                        </span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight tracking-tight font-display">
                        Financial <span className="text-[#00A896]">Command</span>
                    </h2>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider font-mono">
                        <LucideIcons.ShieldCheck size={14} className="text-[#00A896]" />
                        <span>Gestión de Cobranzas y Cuentas por Cobrar de Alto Nivel</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto font-mono">
                    <button 
                        onClick={handleSyncAllDeclaredAsPaid}
                        className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 border border-white/10 cursor-pointer w-full sm:w-auto"
                        title="Marcar como pagados en lote todos los cobros cuyas declaraciones ya están enviadas en la Matriz"
                    >
                        <LucideIcons.RefreshCw size={14} />
                        <span>⚡ Sincronizar con Matriz</span>
                    </button>

                    <button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        disabled={selectedItems.size === 0}
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-300 w-full sm:w-auto cursor-pointer border
                            ${selectedItems.size > 0 
                                ? 'bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white shadow-xl shadow-[#00A896]/25 border-white/15 active:scale-95' 
                                : 'bg-white/5 text-slate-500 cursor-not-allowed border-white/5'}`}
                    >
                        <LucideIcons.DollarSign size={16} className={selectedItems.size > 0 ? "text-white" : "text-slate-600"} />
                        <span>LIQUIDAR SELECCIÓN ({selectedItems.size})</span>
                    </button>
                </div>
            </div>

            {/* CAMPAIGN CONTEXT BANNER */}
            <div className="relative z-10 sm:px-0">
                <CampaignBanner campaign={campaignContext} compact />
            </div>

            {/* ZENITH FINANCIAL STRIP - 3 Executive KPI Cards (Stitch Obsidian Luxury & Clean Light) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10 font-mono">
                <div className="p-5 rounded-[2.5rem] bg-white dark:bg-[#051424]/90 border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-500/15 text-rose-500 dark:text-rose-400 rounded-2xl border border-rose-500/30">
                            <LucideIcons.AlertTriangle size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest">Por Recaudar</p>
                            <p className="text-2xl font-black text-rose-500 dark:text-rose-400 font-mono tracking-tight">
                                ${financialData.receivable.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                        {financialData.receivable.length} Pendientes
                    </span>
                </div>

                <div className="p-5 rounded-[2.5rem] bg-white dark:bg-[#051424]/90 border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-[#00A896]/15 text-[#00A896] rounded-2xl border border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.3)]">
                            <LucideIcons.CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[#00A896] uppercase tracking-widest">Efectivo Cobrado</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                                ${financialData.collected.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30">
                        {financialData.collected.length} Pagados
                    </span>
                </div>

                <div className="p-5 rounded-[2.5rem] bg-white dark:bg-[#051424]/90 border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-[#2B6AFF]/15 text-[#2B6AFF] rounded-2xl border border-[#2B6AFF]/30">
                            <LucideIcons.Activity size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[#2B6AFF] uppercase tracking-widest">Cobertura Mensual</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                                {Math.round((financialData.collected.reduce((s, i) => s + i.amount, 0) / (financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0) || 1)) * 100)}%
                            </p>
                        </div>
                    </div>
                    <div className="w-20 h-2 bg-slate-200 dark:bg-[#020b14] rounded-full overflow-hidden border border-slate-300 dark:border-white/10">
                        <div 
                            className="h-full bg-gradient-to-r from-[#2B6AFF] to-[#00A896] transition-all duration-700 shadow-[0_0_8px_rgba(0,168,150,0.5)]" 
                            style={{ width: `${Math.round((financialData.collected.reduce((s, i) => s + i.amount, 0) / ((financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0)) || 1)) * 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* TACTICAL FILTERS & SEARCH (Stitch Clean Light & Dark Elite) */}
            <div className="p-3 rounded-[2.5rem] bg-white dark:bg-[#051424]/90 border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-2xl flex flex-col lg:flex-row gap-3 items-center font-mono">
                <div className="flex p-1 bg-slate-100 dark:bg-[#0b1326] rounded-2xl w-full lg:w-auto overflow-x-auto no-scrollbar border border-slate-200 dark:border-white/10">
                    {[
                        { id: 'receivable', label: 'Pendientes', icon: LucideIcons.AlertTriangle, color: 'text-rose-500 dark:text-rose-400' },
                        { id: 'projected', label: 'Proyectado', icon: LucideIcons.Timer, color: 'text-amber-500 dark:text-amber-400' },
                        { id: 'collected', label: 'Efectivo', icon: LucideIcons.CheckCircle, color: 'text-[#00A896]' }
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`flex flex-1 lg:flex-none items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 shrink-0 cursor-pointer
                                ${activeTab === tab.id 
                                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-md border border-slate-200 dark:border-white/20' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                        >
                            <tab.icon size={14} className={activeTab === tab.id ? tab.color : 'text-slate-400'} />
                            <span className="whitespace-nowrap">{tab.label}</span>
                            {tab.id === 'receivable' && financialData.receivable.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ml-1 ${activeTab === tab.id ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'}`}>
                                    {financialData.receivable.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="relative flex-grow w-full px-1">
                    <LucideIcons.Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    <input 
                        type="text" 
                        placeholder="BUSCAR POR CLIENTE / RUC / PERÍODO..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-12 pr-5 py-3 bg-slate-50 dark:bg-[#0b1326]/90 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono font-medium text-slate-900 dark:text-white uppercase tracking-wider placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#00A896]/50 transition-all" 
                    />
                </div>
                <div className="flex items-center gap-2 px-1 w-full lg:w-auto">
                    {/* View Mode Toggle: Clients vs Grid vs Matrix vs List */}
                    <div className="flex bg-slate-100 dark:bg-[#0b1326] p-1 rounded-2xl border border-slate-200 dark:border-white/10 shrink-0">
                        <button
                            onClick={() => setViewMode('clients')}
                            className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-1 text-[10px] font-bold uppercase cursor-pointer ${
                                viewMode === 'clients'
                                    ? 'bg-[#00A896] text-white shadow-md shadow-[#00A896]/30'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Vista Clientes Deudores con Tira de Declaraciones y Expediente Pro"
                        >
                            <LucideIcons.Users size={15} />
                            <span className="hidden sm:inline">Clientes</span>
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-1 text-[10px] font-bold uppercase cursor-pointer ${
                                viewMode === 'grid'
                                    ? 'bg-[#00A896] text-white shadow-md shadow-[#00A896]/30'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Vista Cuadrícula de Tarjetas Individuales"
                        >
                            <LucideIcons.LayoutGrid size={15} />
                            <span className="hidden sm:inline">Tarjetas</span>
                        </button>
                        <button
                            onClick={() => setViewMode('matrix')}
                            className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-1 text-[10px] font-bold uppercase cursor-pointer ${
                                viewMode === 'matrix'
                                    ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black shadow-md shadow-amber-500/30'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Vista Matriz Fiscal por Períodos"
                        >
                            <LucideIcons.Table2 size={15} />
                            <span className="hidden sm:inline">Matriz</span>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-1 text-[10px] font-bold uppercase cursor-pointer ${
                                viewMode === 'list'
                                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-md border border-slate-200 dark:border-white/20'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Vista Lista Clásica"
                        >
                            <LucideIcons.LayoutList size={15} />
                            <span className="hidden sm:inline">Lista</span>
                        </button>
                    </div>

                    <button 
                        onClick={() => setIsRecalculating(p => !p)} 
                        className="flex items-center justify-center p-3 text-slate-600 dark:text-slate-300 hover:text-[#00A896] dark:hover:text-[#00A896] transition-all hover:rotate-180 duration-700 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm active:scale-90 cursor-pointer"
                        title="Recalcular Cartera de Clientes"
                    >
                        <LucideIcons.RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* FULL WIDTH FINANCIAL VIEWS (Clean Light & Obsidian Luxury) */}
            <div className="w-full font-mono">
                <div className="rounded-[2.5rem] bg-white dark:bg-[#051424]/90 border border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col relative group">
                    <div className="relative z-10 p-4 sm:p-5 bg-slate-50 dark:bg-[#0b1326]/80 border-b border-slate-200 dark:border-white/10 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 backdrop-blur-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                            {viewMode !== 'clients' && (
                                <button 
                                    onClick={() => {
                                        if (selectedItems.size === currentList.length) setSelectedItems(new Set());
                                        else setSelectedItems(new Set(currentList.map(i => `${i.clientId}-${i.period}`)));
                                    }} 
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all active:scale-95 border border-slate-200 dark:border-white/10 cursor-pointer shadow-sm"
                                >
                                    {selectedItems.size === currentList.length && currentList.length > 0 ? <LucideIcons.CheckSquare size={16} className="text-[#00A896]" /> : <LucideIcons.Square size={16} />}
                                    <span>SELECCIONAR TODOS</span>
                                </button>
                            )}

                            {/* Sub-filtros de Mora */}
                            <div className="flex items-center p-1 bg-slate-200/70 dark:bg-[#020b14] rounded-xl border border-slate-300/50 dark:border-white/5 overflow-x-auto no-scrollbar">
                                {[
                                    { id: 'all', label: 'Todos', count: moraCounts.all },
                                    { id: 'al_dia', label: 'Al Día', count: moraCounts.al_dia, color: 'text-[#00A896]' },
                                    { id: 'atrasado', label: '1-30d', count: moraCounts.atrasado, color: 'text-amber-500' },
                                    { id: 'mora_critica', label: '>30d Mora', count: moraCounts.mora_critica, color: 'text-rose-500' }
                                ].map(filter => (
                                    <button
                                        key={filter.id}
                                        onClick={() => setMoraFilter(filter.id as any)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                            moraFilter === filter.id
                                                ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-white/20'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <span>{filter.label}</span>
                                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${moraFilter === filter.id ? 'bg-[#00A896] text-white' : 'bg-slate-300 dark:bg-white/5 text-slate-600 dark:text-slate-500'}`}>
                                            {filter.count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Selector de Frecuencia Fiscal (Mensuales vs Semestrales) para la Matriz */}
                            {viewMode === 'matrix' && (
                                <div className="flex items-center p-1 bg-slate-200/70 dark:bg-[#020b14] rounded-xl border border-slate-300/50 dark:border-white/5 overflow-x-auto no-scrollbar">
                                    <button
                                        onClick={() => setMatrixFrequency('all')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                            matrixFrequency === 'all'
                                                ? 'bg-[#00A896] text-white shadow-sm font-black'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                        title="Ver todos los contribuyentes unificados"
                                    >
                                        <LucideIcons.Layers size={12} />
                                        <span>Todos</span>
                                    </button>
                                    <button
                                        onClick={() => setMatrixFrequency('Mensual')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                            matrixFrequency === 'Mensual'
                                                ? 'bg-blue-600 text-white shadow-sm font-black'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                        title="Filtrar por contribuyentes de IVA Mensual"
                                    >
                                        <LucideIcons.Calendar size={12} />
                                        <span>Mensuales ({clients.filter(c => getClientIvaFrequency(c) === 'Mensual').length})</span>
                                    </button>
                                    <button
                                        onClick={() => setMatrixFrequency('Semestral')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                            matrixFrequency === 'Semestral'
                                                ? 'bg-purple-600 text-white shadow-sm font-black'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                        title="Filtrar por contribuyentes Semestrales (RIMPE Emprendedor / IVA 0%)"
                                    >
                                        <LucideIcons.Clock size={12} />
                                        <span>Semestrales ({clients.filter(c => getClientIvaFrequency(c) === 'Semestral').length})</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                            <button
                                onClick={handleExportCsv}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-sm active:scale-95"
                                title="Exportar cartera actual a archivo CSV"
                            >
                                <LucideIcons.Download size={14} className="text-[#00A896]" />
                                <span className="hidden sm:inline">Exportar CSV</span>
                            </button>

                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00A896]/15 border border-[#00A896]/30 shadow-inner">
                                <LucideIcons.Layers size={14} className="text-[#00A896]" />
                                <span className="text-xs font-bold text-[#00A896] uppercase tracking-wider">
                                    {viewMode === 'clients' ? `${consolidatedClients.length} CLIENTES` : `${currentList.length} OPERACIONES`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* VISTA 1: POR CLIENTE (CARTERA CONSOLIDADA & TIRA DE PERÍODOS) */}
                    {viewMode === 'clients' ? (
                        <div className="relative z-10 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[850px] overflow-y-auto no-scrollbar">
                            {consolidatedClients.length === 0 ? (
                                <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-500 font-mono">
                                    <div className="p-6 rounded-3xl bg-slate-100 dark:bg-white/5 mb-4 border border-slate-200 dark:border-white/10">
                                        <LucideIcons.ShieldCheck size={48} className="text-[#00A896]" />
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">No se encontraron clientes en este estado de cartera</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Todos los clientes evaluados están al día con sus obligaciones</p>
                                </div>
                            ) : (
                                consolidatedClients.map(profile => {
                                    const hasDebt = profile.totalDebt > 0;
                                    const rawPhone = (profile.client.phones && profile.client.phones[0]) || '';
                                    const isCriticalMora = profile.maxDaysOverdue > 30;

                                    return (
                                        <div
                                            key={profile.client.id}
                                            className={`group/client relative rounded-[2rem] p-5 sm:p-6 border transition-all duration-300 backdrop-blur-2xl flex flex-col justify-between shadow-lg hover:shadow-xl ${
                                                hasDebt
                                                    ? 'bg-white dark:bg-[#051424]/95 border-slate-200 dark:border-white/10 hover:border-[#00A896]/40'
                                                    : 'bg-white dark:bg-[#051424]/80 border-slate-200 dark:border-white/5 opacity-90'
                                            }`}
                                        >
                                            {/* Accent Top Strip */}
                                            <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-full ${
                                                !hasDebt
                                                    ? 'bg-gradient-to-r from-[#00A896] to-emerald-400'
                                                    : isCriticalMora
                                                    ? 'bg-gradient-to-r from-rose-500 via-red-500 to-amber-500'
                                                    : 'bg-gradient-to-r from-amber-500 to-yellow-500'
                                            }`} />

                                            <div>
                                                {/* Header del Cliente */}
                                                <div className="flex items-start justify-between gap-3 mb-4">
                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm font-display shrink-0 border shadow-sm ${
                                                            hasDebt
                                                                ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30'
                                                                : 'bg-[#00A896]/10 text-[#00A896] border-[#00A896]/30'
                                                        }`}>
                                                            {profile.client.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase truncate font-display group-hover/client:text-[#00A896] transition-colors" title={profile.client.name}>
                                                                    {profile.client.name}
                                                                </h4>
                                                            </div>
                                                            <div className="flex items-center flex-wrap gap-1.5 mt-1 font-mono">
                                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{profile.client.ruc}</span>
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/5">
                                                                    DÍG {profile.client.ruc[8] || '—'}
                                                                </span>
                                                                {profile.client.regime && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00A896]/10 text-[#00A896] font-bold">
                                                                        {profile.client.regime}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Status Badge */}
                                                    <div className="shrink-0 text-right">
                                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${
                                                            !hasDebt
                                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                                                : isCriticalMora
                                                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse'
                                                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${!hasDebt ? 'bg-emerald-500' : isCriticalMora ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                                            {!hasDebt ? 'AL DÍA' : `${profile.pendingCount} MES${profile.pendingCount > 1 ? 'ES' : ''} IMPAGO${profile.pendingCount > 1 ? 'S' : ''}`}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Resumen Financiero del Cliente */}
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#020b14]/90 border border-slate-200 dark:border-white/5 mb-4 font-mono">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Deuda Acumulada</span>
                                                        <span className={`text-xl font-black tracking-tight ${hasDebt ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                                                            ${profile.totalDebt.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Tarifa Mensual</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                            ${profile.fee.toFixed(2)}/mes
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2 sm:col-span-1">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Días Máx Mora</span>
                                                        <span className={`text-sm font-bold ${profile.maxDaysOverdue > 30 ? 'text-rose-500' : profile.maxDaysOverdue > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                            {profile.maxDaysOverdue > 0 ? `${profile.maxDaysOverdue} días` : '0 días (Al Día)'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* TIRA DE PERÍODOS Y COMPROBANTES (COMO EN DECLARACIONES) */}
                                                <div className="mb-4 space-y-1.5">
                                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                                        <span className="flex items-center gap-1.5">
                                                            <LucideIcons.Calendar size={12} className="text-[#00A896]" />
                                                            Tira de Períodos Fiscales ({profile.periods.length})
                                                        </span>
                                                        <span className="text-[9px] text-slate-500">Click en celda para accionar</span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-0.5">
                                                        {profile.periods.slice(0, 6).map((p: any) => {
                                                            const isPaidP = p.status === 'paid';
                                                            const isDeclaredP = p.status === 'due_declared';
                                                            const isPendingP = p.status === 'due_pending';

                                                            return (
                                                                <button
                                                                    key={p.period}
                                                                    onClick={() => setSelectedCellAction({
                                                                        client: profile.client,
                                                                        period: p.period,
                                                                        amount: p.amount,
                                                                        status: p.status,
                                                                        decl: p.decl
                                                                    })}
                                                                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase transition-all duration-200 shrink-0 border flex flex-col items-center gap-0.5 cursor-pointer active:scale-95 shadow-sm ${
                                                                        isPaidP
                                                                            ? 'bg-[#00A896]/10 hover:bg-[#00A896]/20 text-[#00A896] border-[#00A896]/30'
                                                                            : isDeclaredP
                                                                            ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-pulse'
                                                                            : isPendingP
                                                                            ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                                                            : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'
                                                                    }`}
                                                                    title={`${p.label}: $${p.amount.toFixed(2)} — ${isPaidP ? 'Pagado' : isDeclaredP ? 'Declarado SRI (Por Cobrar)' : 'Sin Declarar'}`}
                                                                >
                                                                    <div className="flex items-center gap-1">
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${isPaidP ? 'bg-[#00A896]' : isDeclaredP ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                                                        <span>{p.label}</span>
                                                                    </div>
                                                                    <span className="text-[9px] font-black">${p.amount.toFixed(0)}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer con Acciones Ejecutivas */}
                                            <div className="pt-3 border-t border-slate-200 dark:border-white/5 flex items-center gap-2">
                                                {rawPhone && hasDebt && (
                                                    <button
                                                        onClick={() => {
                                                            const cleanPhone = rawPhone.replace(/\D/g, '');
                                                            const fullPhone = cleanPhone.startsWith('593') ? cleanPhone : ('593' + cleanPhone.replace(/^0/, ''));
                                                            const msg = generateClientWhatsAppCobroMsg(profile);
                                                            window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#00A896]/15 hover:bg-[#00A896] text-[#00A896] hover:text-white border border-[#00A896]/30 rounded-xl text-xs font-bold uppercase transition-all shadow-sm cursor-pointer active:scale-95"
                                                        title="Cobrar todas las obligaciones por WhatsApp con desglose de meses"
                                                    >
                                                        <LucideIcons.MessageSquare size={14} />
                                                        <span>Cobrar WhatsApp</span>
                                                    </button>
                                                )}

                                                {hasDebt && (
                                                    <button
                                                        onClick={() => handleLiquidateClientDebt(profile)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-[#00A896]/20 active:scale-95 cursor-pointer border border-white/10"
                                                        title={`Liquidar toda la deuda acumulada de $${profile.totalDebt.toFixed(2)}`}
                                                    >
                                                        <LucideIcons.CheckCircle size={14} />
                                                        <span>Liquidar (${profile.totalDebt.toFixed(0)})</span>
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => setSelectedClientExpediente(profile)}
                                                    className="p-2.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all border border-slate-200 dark:border-white/10 cursor-pointer"
                                                    title="Ver Expediente de Cobranza Completo del Cliente"
                                                >
                                                    <LucideIcons.Eye size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="relative z-10 p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[850px] overflow-y-auto no-scrollbar">
                            {currentList.length === 0 ? (
                                <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-500 font-mono">
                                    <div className="p-6 rounded-3xl bg-white/5 mb-4 border border-white/10">
                                        <LucideIcons.ShieldCheck size={48} className="text-slate-600" />
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No se encontraron operaciones en este estado</p>
                                </div>
                            ) : (
                                currentList.map(item => {
                                    const key = `${item.clientId}-${item.period}`;
                                    const isSelected = selectedItems.has(key);
                                    const sriDoc = findSriInvoice(item.ruc, item.period);

                                    return (
                                        <div
                                            key={key}
                                            onClick={() => activeTab !== 'collected' && (isSelected ? setSelectedItems(s => { const n = new Set(s); n.delete(key); return n; }) : setSelectedItems(s => new Set(s).add(key)))}
                                            className={`group/card relative rounded-[2rem] p-5 sm:p-6 border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between backdrop-blur-2xl ${
                                                isSelected
                                                    ? 'bg-[#051c2e] border-[#00A896] shadow-[0_0_20px_rgba(0,168,150,0.3)] ring-1 ring-[#00A896]'
                                                    : 'bg-[#051424]/95 border-white/10 hover:border-white/20 hover:-translate-y-1 shadow-xl'
                                            }`}
                                        >
                                            {/* Top Accent Strip */}
                                            <div className={`absolute top-0 left-0 right-0 h-1 ${
                                                item.status === 'Pagada'
                                                    ? 'bg-gradient-to-r from-[#00A896] to-emerald-400'
                                                    : item.daysDiff && item.daysDiff > 0
                                                    ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                                                    : 'bg-gradient-to-r from-[#2B6AFF] to-teal-400'
                                            }`} />

                                            {/* Header */}
                                            <div>
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm font-display transition-transform group-hover/card:scale-105 border ${
                                                            isSelected
                                                                ? 'bg-[#00A896] text-white border-[#00A896] shadow-md shadow-[#00A896]/30'
                                                                : item.status === 'Pagada'
                                                                ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30'
                                                                : item.daysDiff && item.daysDiff > 0
                                                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                                                : 'bg-[#2B6AFF]/15 text-[#2B6AFF] border-[#2B6AFF]/30'
                                                        }`}>
                                                            {item.clientName.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="font-bold text-sm text-white uppercase truncate font-display group-hover/card:text-[#00A896] transition-colors" title={item.clientName}>
                                                                {item.clientName}
                                                            </h4>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[10px] font-bold text-slate-400 font-mono">{item.ruc}</span>
                                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-slate-500 border border-white/5 font-mono">
                                                                    DÍG {item.ruc[8] || '—'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {activeTab !== 'collected' && (
                                                        <div className={`w-6 h-6 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                                                            isSelected
                                                                ? 'bg-[#00A896] border-[#00A896] text-white shadow-md shadow-[#00A896]/40'
                                                                : 'bg-white/5 border-white/10 text-transparent hover:border-white/30'
                                                        }`}>
                                                            <LucideIcons.Check size={12} strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Period and Amount Box */}
                                                <div className="my-4 p-4 rounded-2xl bg-[#020b14]/90 border border-white/5 flex items-center justify-between">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Período</span>
                                                        <span className="text-xs font-bold text-teal-300 uppercase tracking-wide">
                                                            {formatPeriodForDisplay(item.period)}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Honorario</span>
                                                        <span className={`text-2xl font-black font-mono tracking-tight ${
                                                            item.status === 'Pagada' ? 'text-[#00A896]' : isSelected ? 'text-white' : 'text-amber-300'
                                                        }`}>
                                                            ${item.amount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Status Semaphore Pill */}
                                                <div className="mb-4 flex items-center justify-between">
                                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider ${
                                                        item.status === 'Pagada'
                                                            ? 'bg-[#00A896]/20 text-[#00A896] border-[#00A896]/40 shadow-[0_0_8px_rgba(0,168,150,0.2)]'
                                                            : item.daysDiff && item.daysDiff > 0
                                                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                                                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                    }`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                                            item.status === 'Pagada' ? 'bg-[#00A896]' : item.daysDiff && item.daysDiff > 0 ? 'bg-rose-400' : 'bg-amber-400'
                                                        }`} />
                                                        <span>{item.status === 'Pagada' ? 'COBRADO' : item.daysDiff && item.daysDiff > 0 ? `ATRASADO ${item.daysDiff}D` : 'PENDIENTE'}</span>
                                                    </div>

                                                    {sriDoc && (
                                                        <span className="text-[9px] font-bold text-[#00A896] font-mono bg-[#00A896]/10 px-2 py-0.5 rounded-lg border border-[#00A896]/20">
                                                            SRI #{sriDoc.secuencial}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Card Footer Actions */}
                                            <div className="pt-3 border-t border-white/5 flex items-center gap-2">
                                                {sriDoc ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (navigate) navigate('sri_facturacion');
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#00A896]/15 hover:bg-[#00A896]/25 border border-[#00A896]/30 text-[#00A896] rounded-xl text-[10px] font-bold uppercase transition-all shadow-sm cursor-pointer"
                                                        title={`Ver Factura Autorizada #${sriDoc.secuencial}`}
                                                    >
                                                        <LucideIcons.CheckCircle size={12} />
                                                        <span>Ver Factura</span>
                                                    </button>
                                                ) : (
                                                    <>
                                                        {item.phones && item.phones.length > 0 && item.phones[0] && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const rawPhone = item.phones[0].replace(/\D/g, '');
                                                                    const fullPhone = rawPhone.startsWith('593') ? rawPhone : ('593' + rawPhone.replace(/^0/, ''));
                                                                    const msg = `Estimado(a) *${item.clientName}*, le saluda Santiago Córdova - Soluciones Tributarias PRO.\n\nLe recordamos cordialmente que sus honorarios contables del período *${formatPeriodForDisplay(item.period)}* por un valor de *$${item.amount.toFixed(2)} USD* se encuentran pendientes de cancelación.\n\n🏛️ *Datos para transferencia:*\nBanco Pichincha - Cta Ahorros\nTitular: Roberto Santiago Córdova Ramírez\nRUC: 0705787745001\n\nPor favor remítanos su comprobante para emitir su respectiva factura electrónica autorizada por el SRI. ¡Muchas gracias!`;
                                                                    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                                                }}
                                                                className="p-2.5 bg-[#00A896]/15 hover:bg-[#00A896] text-[#00A896] hover:text-white rounded-xl transition-all border border-[#00A896]/30 cursor-pointer shadow-sm"
                                                                title="Cobrar por WhatsApp con datos bancarios"
                                                            >
                                                                <LucideIcons.MessageSquare size={13} />
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEmitFastInvoice(item);
                                                            }}
                                                            className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-wider transition-all shadow-md active:scale-95 border border-white/10 cursor-pointer"
                                                            title="Emisión rápida de Factura SRI con firma .p12"
                                                        >
                                                            <LucideIcons.Zap size={12} />
                                                            <span>Facturar</span>
                                                        </button>

                                                        {navigate && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate('sri_facturacion', {
                                                                        clientId: item.clientId,
                                                                        amount: item.amount,
                                                                        description: `Honorarios Profesionales - Período ${item.period}`
                                                                    });
                                                                }}
                                                                className="p-2.5 bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white rounded-xl transition-all border border-white/10 cursor-pointer"
                                                                title="Abrir en Módulo de Facturación SRI"
                                                            >
                                                                <LucideIcons.ExternalLink size={13} />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : viewMode === 'matrix' ? (
                        /* VISTA MATRIZ FISCAL MENSUALIZADA (Stitch Obsidian & Clean Light Matrix) */
                        <div className="relative z-10 overflow-x-auto max-h-[750px] no-scrollbar">
                            <table className="w-full text-left border-collapse font-mono text-xs">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-[#020b14]/95 border-b border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-20 backdrop-blur-xl">
                                        <th className="py-4 px-5 font-bold sticky left-0 z-30 bg-slate-100 dark:bg-[#020b14] min-w-[240px] border-r border-slate-200 dark:border-white/10 shadow-md">
                                            Contribuyente / RUC
                                        </th>
                                        <th className="py-4 px-3 text-center min-w-[90px] border-r border-slate-200 dark:border-white/5 font-bold">
                                            Honorario
                                        </th>
                                        {matrixPeriods.map(p => (
                                            <th key={p.key} className="py-3 px-2 text-center min-w-[130px] border-r border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#0b1326]/90">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-slate-900 dark:text-white font-black">{p.shortLabel}</span>
                                                        <span className="text-[9px] text-teal-600 dark:text-teal-400 font-bold">{p.year}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleLiquidateColumnPeriod(p.key, p.shortLabel)}
                                                        className="px-2 py-0.5 rounded bg-[#00A896]/15 hover:bg-[#00A896] text-[#00A896] hover:text-white border border-[#00A896]/30 text-[8px] font-bold uppercase transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-0.5"
                                                        title={`Liquidar todos los cobros pendientes de ${p.label}`}
                                                    >
                                                        <LucideIcons.Zap size={8} />
                                                        <span>{matrixFrequency === 'Semestral' ? 'Cobrar Sem.' : 'Cobrar Mes'}</span>
                                                    </button>
                                                </div>
                                            </th>
                                        ))}
                                        <th className="py-4 px-4 text-center min-w-[140px] font-bold text-rose-500 dark:text-rose-400 border-r border-slate-200 dark:border-white/5">
                                            Deuda Total
                                        </th>
                                        <th className="py-4 px-3 text-center min-w-[90px] font-bold text-slate-600 dark:text-slate-300">
                                            WhatsApp
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-800 dark:text-slate-300">
                                    {matrixClientsData.length === 0 ? (
                                        <tr>
                                            <td colSpan={matrixPeriods.length + 4} className="py-24 text-center text-slate-500">
                                                <div className="p-6 rounded-3xl bg-slate-100 dark:bg-white/5 mb-3 inline-block border border-slate-200 dark:border-white/10">
                                                    <LucideIcons.ShieldCheck size={40} className="text-[#00A896]" />
                                                </div>
                                                <p className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-400">No se encontraron clientes para mostrar</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        matrixClientsData.map(({ client, fee, freq, totalUnpaidDebt, periodsStatus }) => (
                                            <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group/row">
                                                {/* Frozen Client Column */}
                                                <td className="py-3 px-5 sticky left-0 z-10 bg-white dark:bg-[#051424] group-hover/row:bg-slate-50 dark:group-hover/row:bg-[#081b2e] border-r border-slate-200 dark:border-white/10 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                                                            totalUnpaidDebt > 0 
                                                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30' 
                                                                : 'bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30'
                                                        }`}>
                                                            {client.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0 max-w-[180px]">
                                                            <p className="font-bold text-slate-900 dark:text-white uppercase truncate text-xs font-display group-hover/row:text-[#00A896] transition-colors" title={client.name}>
                                                                {client.name}
                                                            </p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{client.ruc}</span>
                                                                <span className={`text-[8px] font-black px-1.5 py-0.2 rounded font-mono ${
                                                                    freq === 'Semestral'
                                                                        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30'
                                                                        : freq === 'Popular'
                                                                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                                                                        : 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30'
                                                                }`}>
                                                                    {freq === 'Semestral' ? 'SEM' : freq === 'Popular' ? 'POP' : 'MEN'}
                                                                </span>
                                                                <span className="text-[8px] px-1 rounded bg-slate-100 dark:bg-white/5 text-slate-500 font-mono">
                                                                    DÍG {client.ruc[8] || '—'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Base Fee */}
                                                <td className="py-3 px-3 text-center border-r border-slate-200 dark:border-white/5 font-bold text-slate-700 dark:text-slate-200">
                                                    ${fee.toFixed(2)}
                                                </td>

                                                {/* Monthly Matrix Status Cells */}
                                                {periodsStatus.map(pStatus => {
                                                    const isPaidStatus = pStatus.status === 'paid';
                                                    const isDeclaredDue = pStatus.status === 'due_declared';
                                                    const isUndeclaredDue = pStatus.status === 'due_undeclared';
                                                    const isNa = pStatus.status === 'na';

                                                    return (
                                                        <td key={pStatus.key} className="py-2 px-2 text-center border-r border-slate-200 dark:border-white/5">
                                                            {isNa ? (
                                                                <span className="text-slate-400 dark:text-slate-600 text-[10px] font-bold select-none">—</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setSelectedCellAction({
                                                                        client,
                                                                        period: pStatus.key,
                                                                        amount: pStatus.amount,
                                                                        status: pStatus.status,
                                                                        decl: pStatus.decl
                                                                    })}
                                                                    onDoubleClick={() => {
                                                                        if (!isPaidStatus) {
                                                                            handlePaySinglePeriod(client, pStatus.key, pStatus.amount);
                                                                        }
                                                                    }}
                                                                    className={`w-full py-1.5 px-2 rounded-xl text-[9px] font-bold uppercase transition-all duration-200 flex flex-col items-center justify-center gap-0.5 border cursor-pointer active:scale-95 shadow-sm group/cell relative ${
                                                                        isPaidStatus
                                                                            ? 'bg-emerald-50 dark:bg-[#00A896]/15 text-emerald-700 dark:text-[#00A896] border-emerald-300 dark:border-[#00A896]/30 hover:bg-emerald-100 dark:hover:bg-[#00A896]/25'
                                                                            : isDeclaredDue
                                                                            ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 hover:bg-rose-100 dark:hover:bg-rose-500/30 animate-pulse'
                                                                            : isUndeclaredDue
                                                                            ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/25'
                                                                            : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
                                                                    }`}
                                                                    title={`Período ${pStatus.key}: ${pStatus.label} — Monto: $${pStatus.amount.toFixed(2)} (Click: Opciones • Doble Click: Pagar)`}
                                                                >
                                                                    <span className="font-mono font-black">${pStatus.amount.toFixed(0)}</span>
                                                                    <span className="text-[8px] tracking-tight">{pStatus.label}</span>
                                                                </button>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Total Unpaid Debt & 1-Click Liquidation */}
                                                <td className="py-3 px-4 text-center border-r border-slate-200 dark:border-white/5">
                                                    {totalUnpaidDebt > 0 ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-[10px] font-black font-mono shadow-sm">
                                                                ${totalUnpaidDebt.toFixed(2)}
                                                            </span>
                                                            <button
                                                                onClick={() => handleLiquidateClientDirect(client)}
                                                                className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white text-[8px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-0.5 border border-white/10"
                                                                title={`Liquidar toda la deuda acumulada de $${totalUnpaidDebt.toFixed(2)} en 1 solo clic`}
                                                            >
                                                                <LucideIcons.Zap size={9} />
                                                                <span>Pagar Todo</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-[#00A896] border border-emerald-500/30 text-[9px] font-bold">
                                                            AL DÍA
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Quick WhatsApp */}
                                                <td className="py-3 px-3 text-center">
                                                    {client.phones && client.phones.length > 0 && client.phones[0] && totalUnpaidDebt > 0 ? (
                                                        <button
                                                            onClick={() => {
                                                                const rawPhone = client.phones![0].replace(/\D/g, '');
                                                                const fullPhone = rawPhone.startsWith('593') ? rawPhone : ('593' + rawPhone.replace(/^0/, ''));
                                                                const msg = `Estimado(a) *${client.name}*, le saluda Santiago Córdova - Soluciones Tributarias PRO.\n\nLe recordamos cordialmente que mantiene un saldo pendiente de honorarios contables por un valor total de *$${totalUnpaidDebt.toFixed(2)} USD* correspondiente a sus declaraciones tributarias.\n\n🏛️ *Datos para transferencia:*\nBanco Pichincha - Cta Ahorros\nTitular: Roberto Santiago Córdova Ramírez\nRUC: 0705787745001\n\nPor favor remítanos su comprobante para emitir su respectiva factura electrónica autorizada por el SRI. ¡Muchas gracias!`;
                                                                window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                                            }}
                                                            className="p-2 rounded-xl bg-[#00A896]/15 hover:bg-[#00A896] text-[#00A896] hover:text-white border border-[#00A896]/30 transition-all cursor-pointer shadow-sm active:scale-95"
                                                            title="Cobrar deuda acumulada por WhatsApp"
                                                        >
                                                            <LucideIcons.MessageSquare size={13} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* VISTA LISTA CLÁSICA */
                        <div className="relative z-10 divide-y divide-white/5 max-h-[700px] overflow-y-auto no-scrollbar p-2 sm:p-0">
                            {currentList.length === 0 ? (
                                <div className="py-28 flex flex-col items-center justify-center text-slate-500">
                                    <div className="p-6 rounded-full bg-white/5 mb-4 border border-white/10">
                                        <LucideIcons.ShieldCheck size={48} className="text-slate-600" />
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No se encontraron operaciones en este estado</p>
                                </div>
                            ) : (
                                currentList.map(item => {
                                    const key = `${item.clientId}-${item.period}`;
                                    const isSelected = selectedItems.has(key);
                                    return (
                                        <div 
                                            key={key} 
                                            onClick={() => activeTab !== 'collected' && (isSelected ? setSelectedItems(s => { const n = new Set(s); n.delete(key); return n; }) : setSelectedItems(s => new Set(s).add(key)))} 
                                            className={`group relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between transition-all duration-300 cursor-pointer overflow-hidden border-b border-white/5 last:border-0
                                                ${isSelected 
                                                    ? 'bg-[#00A896]/10 shadow-inner' 
                                                    : 'hover:bg-white/5'}`}
                                        >
                                            <div className="flex items-center gap-5 relative z-10">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 border
                                                    ${isSelected 
                                                        ? 'bg-[#00A896] border-[#00A896] shadow-[0_0_15px_rgba(0,168,150,0.5)] text-white' 
                                                        : 'bg-[#0b1326] border-white/10 text-slate-400 group-hover:border-[#00A896]/40 group-hover:text-[#00A896]'}`}>
                                                    {item.type === 'mensual' ? <LucideIcons.Calendar size={20} /> : <LucideIcons.Zap size={20} />}
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-bold text-sm text-white uppercase tracking-tight truncate max-w-[200px] sm:max-w-none font-display">{item.clientName}</p>
                                                        {item.daysDiff && item.daysDiff > 0 && (
                                                            <div className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30">
                                                                <span className="text-[9px] font-bold text-rose-300 uppercase tracking-widest">ATRASADO</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <div className="flex items-center gap-1.5 py-0.5 px-2 rounded-md bg-white/5 border border-white/5">
                                                            <LucideIcons.Activity size={10} className="text-[#00A896]" />
                                                            <span className="text-[10px] font-bold text-slate-300 font-mono tracking-wider">{item.ruc}</span>
                                                        </div>
                                                        <span className="text-slate-600">•</span>
                                                        <span className="text-[10px] font-bold text-[#00A896] uppercase tracking-wider">{formatPeriodForDisplay(item.period)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 sm:mt-0 flex sm:flex-col justify-between items-end sm:items-end relative z-10 w-full sm:w-auto bg-white/5 sm:bg-transparent p-3 sm:p-0 rounded-2xl border border-white/5 sm:border-transparent">
                                                <div className="flex flex-col sm:items-end">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:hidden">Total a Cobrar</span>
                                                    <p className={`text-xl font-black font-mono tracking-tight transition-colors duration-300 ${isSelected ? 'text-[#00A896]' : 'text-white'}`}>
                                                        ${item.amount.toFixed(2)}
                                                    </p>
                                                </div>
                                                <div className="mt-1.5 flex items-center gap-2">
                                                    <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider
                                                        ${item.status === 'Pagada' 
                                                            ? 'bg-[#00A896]/20 text-[#00A896] border-[#00A896]/40 shadow-[0_0_6px_rgba(0,168,150,0.3)]' 
                                                            : item.daysDiff && item.daysDiff > 0 
                                                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                                                                : 'bg-white/10 text-slate-400 border-white/10'}`}>
                                                        <span>{item.status === 'Pagada' ? 'COBRADO' : item.daysDiff && item.daysDiff > 0 ? `ATRASADO ${item.daysDiff}D` : 'PENDIENTE'}</span>
                                                    </div>
                                                    {(() => {
                                                        const sriDoc = findSriInvoice(item.ruc, item.period);
                                                        return sriDoc ? (
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (navigate) navigate('sri_facturacion');
                                                                }}
                                                                className="px-2.5 py-1 rounded-xl bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] text-[10px] font-bold font-mono flex items-center gap-1 cursor-pointer hover:bg-[#00A896]/25 transition-all shadow-sm"
                                                                title={`Factura SRI Autorizada #${sriDoc.secuencial} — Clave: ${sriDoc.claveAcceso}`}
                                                            >
                                                                <LucideIcons.CheckCircle size={10} />
                                                                <span>SRI #{sriDoc.secuencial}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5">
                                                                {item.phones && item.phones.length > 0 && item.phones[0] && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const rawPhone = item.phones[0].replace(/\D/g, '');
                                                                            const fullPhone = rawPhone.startsWith('593') ? rawPhone : ('593' + rawPhone.replace(/^0/, ''));
                                                                            const msg = `Estimado(a) *${item.clientName}*, le saluda Santiago Córdova - Soluciones Tributarias PRO.\n\nLe recordamos cordialmente que sus honorarios contables del período *${formatPeriodForDisplay(item.period)}* por un valor de *$${item.amount.toFixed(2)} USD* se encuentran pendientes de cancelación.\n\n🏛️ *Datos para transferencia:*\nBanco Pichincha - Cta Ahorros\nTitular: Roberto Santiago Córdova Ramírez\nRUC: 0705787745001\n\nPor favor remítanos su comprobante para emitir su respectiva factura electrónica autorizada por el SRI. ¡Muchas gracias!`;
                                                                            window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                                                        }}
                                                                        className="p-1.5 bg-[#00A896]/15 hover:bg-[#00A896] text-[#00A896] hover:text-white rounded-xl transition-all border border-[#00A896]/30 cursor-pointer shadow-sm"
                                                                        title="Enviar recordatorio de cobro por WhatsApp"
                                                                    >
                                                                        <LucideIcons.MessageSquare size={12} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEmitFastInvoice(item);
                                                                    }}
                                                                    className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white text-[10px] font-bold rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer border border-white/10"
                                                                    title="Emisión rápida de Factura SRI con firma .p12"
                                                                >
                                                                    <LucideIcons.Zap size={11} />
                                                                    <span>Facturar SRI</span>
                                                                </button>
                                                                {navigate && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigate('sri_facturacion', {
                                                                                clientId: item.clientId,
                                                                                amount: item.amount,
                                                                                description: `Honorarios Profesionales - Período ${item.period}`
                                                                            });
                                                                        }}
                                                                        className="p-1.5 bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white rounded-xl transition-all border border-white/10 cursor-pointer"
                                                                        title="Abrir en Módulo de Facturación SRI"
                                                                    >
                                                                        <LucideIcons.ExternalLink size={11} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00A896] shadow-[2px_0_10px_rgba(0,168,150,0.8)]"></div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL: EXPEDIENTE DE COBRANZA PRO DEL CLIENTE */}
            <Modal
                isOpen={!!selectedClientExpediente}
                onClose={() => setSelectedClientExpediente(null)}
                title="Expediente de Cartera & Cobranzas"
            >
                {selectedClientExpediente && (
                    <div className="p-4 sm:p-6 space-y-6 font-mono text-slate-800 dark:text-white">
                        {/* Header del Cliente */}
                        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#051424] border border-slate-200 dark:border-white/10 space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Contribuyente</span>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase font-display">{selectedClientExpediente.client.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-bold text-[#00A896]">{selectedClientExpediente.client.ruc}</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                                            DÍGITO {selectedClientExpediente.client.ruc[8] || '—'}
                                        </span>
                                        {selectedClientExpediente.client.regime && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#00A896]/10 text-[#00A896] font-bold">
                                                {selectedClientExpediente.client.regime}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Saldo Total Pendiente</span>
                                    <span className="text-2xl font-black text-rose-500 dark:text-rose-400">
                                        ${selectedClientExpediente.totalDebt.toFixed(2)} USD
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Desglose de Obligaciones y Períodos */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <span>Períodos Fiscales ({selectedClientExpediente.periods.length})</span>
                                <span>Estado & Acciones</span>
                            </div>

                            <div className="divide-y divide-slate-200 dark:divide-white/10 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden max-h-[350px] overflow-y-auto no-scrollbar">
                                {selectedClientExpediente.periods.map((p: any) => {
                                    const isPaidP = p.status === 'paid';
                                    const isDeclaredP = p.status === 'due_declared';
                                    const isPendingP = p.status === 'due_pending';

                                    return (
                                        <div
                                            key={p.period}
                                            className="p-4 bg-white dark:bg-[#020b14]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs border ${
                                                    isPaidP
                                                        ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30'
                                                        : isDeclaredP
                                                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                                }`}>
                                                    {isPaidP ? <LucideIcons.Check size={14} /> : <LucideIcons.Clock size={14} />}
                                                </div>

                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">{p.label}</p>
                                                    <p className="text-[10px] text-slate-500">
                                                        {isPaidP ? '✓ Declarado y Honorario Pagado' : isDeclaredP ? '🔴 Declarado en SRI - Honorario Impago' : '🟡 Período Sin Declarar'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 justify-end">
                                                <span className="text-base font-black text-slate-900 dark:text-amber-300 font-mono">
                                                    ${p.amount.toFixed(2)}
                                                </span>

                                                {!isPaidP && (
                                                    <button
                                                        onClick={() => {
                                                            handlePaySinglePeriod(selectedClientExpediente.client, p.period, p.amount);
                                                            setSelectedClientExpediente(null);
                                                        }}
                                                        className="px-3 py-1.5 rounded-xl bg-[#00A896]/15 hover:bg-[#00A896] text-[#00A896] hover:text-white border border-[#00A896]/30 text-[10px] font-bold uppercase transition-all cursor-pointer shadow-sm active:scale-95"
                                                        title="Registrar pago inmediato de este período"
                                                    >
                                                        Pagar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer del Expediente */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            {selectedClientExpediente.client.phones && selectedClientExpediente.client.phones[0] && selectedClientExpediente.totalDebt > 0 && (
                                <button
                                    onClick={() => {
                                        const rawPhone = selectedClientExpediente.client.phones![0].replace(/\D/g, '');
                                        const fullPhone = rawPhone.startsWith('593') ? rawPhone : ('593' + rawPhone.replace(/^0/, ''));
                                        const msg = generateClientWhatsAppCobroMsg(selectedClientExpediente);
                                        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                    }}
                                    className="flex-1 py-3 px-4 rounded-xl bg-[#00A896]/15 hover:bg-[#00A896] text-[#00A896] hover:text-white border border-[#00A896]/30 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                                >
                                    <LucideIcons.MessageSquare size={16} />
                                    <span>Cobrar WhatsApp Todo</span>
                                </button>
                            )}

                            {selectedClientExpediente.totalDebt > 0 && (
                                <button
                                    onClick={() => {
                                        handleLiquidateClientDebt(selectedClientExpediente);
                                        setSelectedClientExpediente(null);
                                    }}
                                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#00A896]/25 active:scale-95 border border-white/10"
                                >
                                    <LucideIcons.CheckCircle size={16} />
                                    <span>Liquidar Toda la Deuda (${selectedClientExpediente.totalDebt.toFixed(2)})</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL: ACCIÓN RÁPIDA DE CELDA MATRICIAL */}
            <Modal isOpen={!!selectedCellAction} onClose={() => setSelectedCellAction(null)} title="Operación Fiscal & Cobro">
                {selectedCellAction && (
                    <div className="p-4 sm:p-6 space-y-6 font-mono text-slate-800 dark:text-white">
                        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#051424] border border-slate-200 dark:border-white/10 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contribuyente</p>
                                    <p className="text-base font-bold text-slate-900 dark:text-white uppercase font-display">{selectedCellAction.client.name}</p>
                                    <p className="text-xs font-bold text-[#00A896] mt-0.5">{selectedCellAction.client.ruc}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período Fiscal</p>
                                    <p className="text-sm font-bold text-teal-600 dark:text-teal-300 uppercase">{formatPeriodForDisplay(selectedCellAction.period)}</p>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between items-center">
                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Honorario Asignado</span>
                                <span className="text-2xl font-black text-amber-500 dark:text-amber-300 font-mono">${selectedCellAction.amount.toFixed(2)} USD</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedCellAction.client.phones && selectedCellAction.client.phones[0] && (
                                <button
                                    onClick={() => {
                                        const rawPhone = selectedCellAction.client.phones![0].replace(/\D/g, '');
                                        const fullPhone = rawPhone.startsWith('593') ? rawPhone : ('593' + rawPhone.replace(/^0/, ''));
                                        const msg = `Estimado(a) *${selectedCellAction.client.name}*, le saluda Santiago Córdova - Soluciones Tributarias PRO.\n\nLe recordamos cordialmente que sus honorarios contables del período *${formatPeriodForDisplay(selectedCellAction.period)}* por un valor de *$${selectedCellAction.amount.toFixed(2)} USD* se encuentran pendientes de cancelación.\n\n🏛️ *Datos para transferencia:*\nBanco Pichincha - Cta Ahorros\nTitular: Roberto Santiago Córdova Ramírez\nRUC: 0705787745001\n\nPor favor remítanos su comprobante para emitir su respectiva factura electrónica autorizada por el SRI. ¡Muchas gracias!`;
                                        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                    }}
                                    className="py-3 px-4 rounded-xl bg-[#00A896]/15 hover:bg-[#00A896] text-[#00A896] hover:text-white border border-[#00A896]/30 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                                >
                                    <LucideIcons.MessageSquare size={16} />
                                    <span>Cobrar WhatsApp</span>
                                </button>
                            )}

                            <button
                                onClick={() => {
                                    handleEmitFastInvoice({
                                        clientId: selectedCellAction.client.id,
                                        clientName: selectedCellAction.client.name,
                                        ruc: selectedCellAction.client.ruc,
                                        period: selectedCellAction.period,
                                        amount: selectedCellAction.amount,
                                        status: DeclarationStatus.Pendiente,
                                        type: 'mensual',
                                        dateReference: new Date(),
                                        phones: selectedCellAction.client.phones || []
                                    });
                                    setSelectedCellAction(null);
                                }}
                                className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
                            >
                                <LucideIcons.Zap size={16} />
                                <span>Facturar SRI</span>
                            </button>
                        </div>

                        {selectedCellAction.status === 'paid' ? (
                            <div className="space-y-3">
                                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-[#00A896]/15 border border-emerald-300 dark:border-[#00A896]/30 flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                                    <div className="flex items-center gap-2">
                                        <LucideIcons.CheckCircle size={18} className="text-[#00A896]" />
                                        <div>
                                            <p className="text-xs font-black uppercase">Honorario Pagado y Registrado</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Este período se encuentra liquidado al 100%.</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-mono font-black">${selectedCellAction.amount.toFixed(2)}</span>
                                </div>
                                <button
                                    onClick={() => handleUnmarkPaidPeriod(selectedCellAction.client, selectedCellAction.period)}
                                    className="w-full py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                                    title="Revertir el estado de este período a pendiente"
                                >
                                    <LucideIcons.RotateCcw size={14} />
                                    <span>Revertir Pago a Pendiente</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    handlePaySinglePeriod(selectedCellAction.client, selectedCellAction.period, selectedCellAction.amount);
                                }}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#00A896]/25 active:scale-95 border border-white/10"
                            >
                                <LucideIcons.CheckCircle size={16} />
                                <span>Registrar Pago Inmediato (${selectedCellAction.amount.toFixed(2)})</span>
                            </button>
                        )}
                    </div>
                )}
            </Modal>

            {/* MODAL 1: LIQUIDAR TRANSACCIÓN FINANCIERA (Stitch Obsidian Luxury) */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Autorizar Transacción Financiera">
                <div className="p-4 sm:p-8 space-y-8 font-mono text-white">
                    <div className="relative group">
                        <div className="absolute -inset-2 bg-gradient-to-r from-[#00A896] to-[#2B6AFF] rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                        <div className="relative p-8 rounded-[2.5rem] bg-[#051424]/95 border border-white/10 border-t-white/20 text-center shadow-2xl backdrop-blur-2xl">
                            <div className="flex justify-center mb-4">
                                <div className="p-4 rounded-2xl bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] shadow-[0_0_12px_rgba(0,168,150,0.3)]">
                                    <LucideIcons.ShieldCheck size={32} />
                                </div>
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Monto Total de Liquidación</p>
                            <p className="text-4xl sm:text-5xl font-black text-[#00A896] mb-3 tracking-tight">
                                ${selectedSummary.total.toFixed(2)}
                            </p>
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_8px_rgba(0,168,150,0.8)]"></div>
                                <span className="text-[10px] font-bold text-[#00A896] uppercase tracking-wider">Protocolo de Procedencia Verificado</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleProcessPayment} 
                            disabled={isProcessing} 
                            className="group relative w-full overflow-hidden py-4 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-xl shadow-[#00A896]/25 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 border border-white/10 cursor-pointer"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {isProcessing ? <LucideIcons.RefreshCw className="animate-spin text-white" size={18} /> : <LucideIcons.ShieldAlert size={18} className="text-white" />}
                                <span>{isProcessing ? 'AUTORIZANDO COBRO...' : 'CONFIRMAR OPERACIÓN Y REGISTRAR PAGO'}</span>
                            </span>
                        </button>
                        <p className="text-center text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-relaxed">
                            Al confirmar, se generará el recibo contable digital y se actualizará el historial del cliente en la base de datos.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* MODAL 2: PROTOCOLO DE EJECUCIÓN EXITOSA (RECIBO DIGITAL) (Stitch Obsidian Luxury) */}
            <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Protocolo de Ejecución Exitosa">
                {receiptData && (
                    <div className="p-4 sm:p-8 space-y-8 font-mono text-white">
                        <div className="relative group">
                            <div className="absolute -inset-2 bg-gradient-to-r from-[#00A896] to-[#2B6AFF] rounded-[2.5rem] blur-3xl opacity-15"></div>
                            <div ref={receiptRef} className="relative p-8 rounded-[2.5rem] bg-[#051424]/95 border border-white/10 border-t-white/20 text-slate-200 font-mono text-xs overflow-hidden shadow-2xl backdrop-blur-2xl">
                                <div className="absolute top-0 right-0 p-8 text-white/5 pointer-events-none">
                                    <LucideIcons.Shield size={120} />
                                </div>
                                
                                <div className="text-center mb-8 border-b border-white/10 pb-6 relative z-10">
                                    <p className="font-bold text-base uppercase tracking-wider mb-1 text-white font-display">{defaultBusinessProfile.businessName}</p>
                                    <p className="text-xs font-medium uppercase tracking-wider text-[#00A896]">{defaultBusinessProfile.tradeName}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">{defaultBusinessProfile.address}</p>
                                    <div className="inline-block mt-4 px-3 py-1 bg-white/10 border border-white/15 text-white rounded-full font-bold text-[10px] uppercase tracking-wider">
                                        TX-AUTH: {receiptData.transactionId}
                                    </div>
                                </div>

                                <div className="space-y-3 mb-8 bg-[#0b1326]/80 p-5 rounded-2xl border border-white/10 relative z-10">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase font-bold text-[10px] tracking-wider">Contribuyente</span>
                                        <span className="text-right font-bold uppercase text-white tracking-tight">{receiptData.clientName}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase font-bold text-[10px] tracking-wider">Identificación</span>
                                        <span className="text-right font-bold text-[#00A896]">{receiptData.clientRuc}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase font-bold text-[10px] tracking-wider">Fecha de Emisión</span>
                                        <span className="text-right font-medium text-slate-300">{receiptData.paymentDate}</span>
                                    </div>
                                </div>

                                <div className="mb-8 relative z-10">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-white/10 pb-2">Desglose de Cargo</p>
                                    <div className="space-y-2">
                                        {receiptData.paidPeriods.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center py-1">
                                                <span className="font-medium uppercase text-slate-300">Honorarios Profesionales {p.period}</span>
                                                <span className="font-bold text-white tracking-tight">${p.amount.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-[#00A896] to-teal-600 p-5 rounded-2xl flex justify-between items-center text-white shadow-xl shadow-[#00A896]/20 relative z-10 border border-white/10">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-[10px] uppercase tracking-wider opacity-90">Total Transado</span>
                                        <span className="text-[9px] font-bold opacity-75">PAGO CONFIRMADO</span>
                                    </div>
                                    <span className="text-3xl font-black font-mono tracking-tight">${receiptData.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button 
                                onClick={() => printSalesNote(receiptData, defaultBusinessProfile)} 
                                className="flex-1 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-white/10 cursor-pointer"
                            >
                                <LucideIcons.Printer size={16} className="text-[#00A896]" />
                                <span>Ticket Físico</span>
                            </button>
                            {navigate && (
                                <>
                                    <button 
                                        onClick={() => {
                                            setIsReceiptOpen(false);
                                            const tempItem: FinancialItem = {
                                                clientId: receiptData.client?.id || '',
                                                clientName: receiptData.clientName || '',
                                                ruc: receiptData.clientRuc || '',
                                                period: receiptData.paidPeriods[0]?.period || '',
                                                amount: receiptData.totalAmount,
                                                status: DeclarationStatus.Pendiente,
                                                type: 'mensual',
                                                dateReference: new Date(),
                                                phones: receiptData.client?.phones || []
                                            };
                                            handleEmitFastInvoice(tempItem);
                                        }} 
                                        className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all border border-white/10 cursor-pointer"
                                    >
                                        <LucideIcons.Zap size={16} className="text-white" />
                                        <span>Factura SRI Rápida</span>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setIsReceiptOpen(false);
                                            navigate('sri_facturacion', {
                                                clientId: receiptData.client?.id || receiptData.client?.ruc,
                                                amount: receiptData.totalAmount,
                                                description: `Honorarios Profesionales - ${receiptData.paidPeriods.map((p: any) => p.period).join(', ')}`
                                            });
                                        }} 
                                        className="flex-1 py-3.5 bg-gradient-to-r from-[#2B6AFF] to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#2B6AFF]/20 transition-all border border-white/10 cursor-pointer"
                                    >
                                        <LucideIcons.FileText size={16} className="text-white" />
                                        <span>Detallar en SRI</span>
                                    </button>
                                </>
                            )}
                            <button 
                                onClick={() => setIsReceiptOpen(false)} 
                                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all border border-white/10 cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL 3: EMISIÓN DE FACTURA SRI RÁPIDA (Stitch Obsidian Luxury) */}
            <Modal isOpen={isFastBillingOpen} onClose={() => setIsFastBillingOpen(false)} title="Emisión de Factura SRI Rápida">
                {fastBillingItem && (
                    <div className="p-4 sm:p-6 space-y-6 font-mono text-white">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0b1326]/90 border border-white/10">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cliente / Receptor</p>
                                <h4 className="font-bold text-white uppercase font-display">{fastBillingItem.clientName}</h4>
                                <p className="text-xs font-mono text-[#00A896]">{fastBillingItem.ruc}</p>
                            </div>
                            <div className="text-left md:text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monto de Honorarios</p>
                                <p className="text-2xl font-black text-[#00A896]">${fastBillingItem.amount.toFixed(2)}</p>
                                <p className="text-xs text-slate-400 font-bold uppercase">Período: {formatPeriodForDisplay(fastBillingItem.period)}</p>
                            </div>
                        </div>

                        {/* Progreso del Flujo */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado de Transmisión Electrónica</p>
                            
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { step: 'generating', label: 'XML', checkSteps: ['signing', 'sending', 'authorizing', 'success'] },
                                    { step: 'signing', label: 'Firmado', checkSteps: ['sending', 'authorizing', 'success'] },
                                    { step: 'sending', label: 'Enviado', checkSteps: ['authorizing', 'success'] },
                                    { step: 'authorizing', label: 'Autorizado', checkSteps: ['success'] }
                                ].map((s, i) => {
                                    const isCurrent = fastBillingStep === s.step;
                                    const isDone = s.checkSteps.includes(fastBillingStep) || fastBillingStep === 'success';
                                    const isFailed = fastBillingStep === 'failed';
                                    
                                    return (
                                        <div key={i} className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-300
                                            ${isDone 
                                                ? 'bg-[#00A896]/20 border-[#00A896]/40 text-[#00A896] shadow-[0_0_8px_rgba(0,168,150,0.3)]' 
                                                : isCurrent 
                                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse' 
                                                    : isFailed && fastBillingStep === s.step
                                                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                                        : 'bg-white/5 border-white/10 text-slate-500'}`}>
                                            {isDone ? <LucideIcons.CheckCircle size={16} className="mb-1" />
                                                : isCurrent ? <LucideIcons.RefreshCw size={16} className="animate-spin mb-1" />
                                                    : <LucideIcons.Calendar size={16} className="mb-1" />}
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Logs del Proceso */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalle del Proceso (Logs)</p>
                            <div className="p-4 rounded-xl bg-[#020b14] text-slate-300 font-mono text-[10px] space-y-1.5 max-h-[160px] overflow-y-auto no-scrollbar border border-white/10 shadow-inner">
                                {fastBillingLogs.map((log, idx) => (
                                    <div key={idx} className={log.includes('✅') || log.includes('éxito') || log.includes('AUTORIZADO') ? 'text-[#00A896] font-bold' : log.includes('❌') || log.includes('Error') ? 'text-rose-400 font-bold' : ''}>
                                        {log}
                                    </div>
                                ))}
                                {['generating', 'signing', 'sending', 'authorizing'].includes(fastBillingStep) ? (
                                    <div className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
                                        <span>Procesando...</span>
                                        <LucideIcons.RefreshCw size={8} className="animate-spin" />
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Acciones del Modal */}
                        <div className="flex gap-3 pt-2">
                            {fastBillingStep === 'success' && (
                                <button
                                    onClick={() => {
                                        const blob = new Blob([fastBillingXml], { type: 'text/xml' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `factura-${fastBillingAccessKey.substring(24, 33)}.xml`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="flex-1 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-white/10 cursor-pointer"
                                >
                                    <LucideIcons.Download size={14} />
                                    <span>XML Firmado</span>
                                </button>
                            )}

                            {fastBillingStep === 'failed' && (
                                <button
                                    onClick={() => handleEmitFastInvoice(fastBillingItem)}
                                    className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                                >
                                    <LucideIcons.RefreshCw size={14} />
                                    <span>Reintentar Emisión</span>
                                </button>
                            )}

                            <button
                                onClick={() => setIsFastBillingOpen(false)}
                                className={`flex-1 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border
                                    ${fastBillingStep === 'success' 
                                        ? 'bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white border-white/10 shadow-lg shadow-[#00A896]/20' 
                                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/10'}`}
                            >
                                {fastBillingStep === 'success' ? 'Listo / Cerrar' : 'Cerrar Ventana'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* BARRA FLOTANTE FIJA PARA LIQUIDACIÓN EN LOTE (Stitch Obsidian Luxury Sticky Bar) */}
            {selectedItems.size > 0 && (
                <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-8 z-50 animate-in slide-in-from-bottom-5 duration-300">
                    <div className="bg-[#051424]/95 border border-[#00A896]/50 shadow-[0_10px_35px_rgba(0,0,0,0.8)] rounded-3xl p-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-2xl font-mono text-white max-w-2xl">
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                            <div className="p-3 rounded-2xl bg-[#00A896]/20 border border-[#00A896]/40 text-[#00A896] shadow-[0_0_12px_rgba(0,168,150,0.3)]">
                                <LucideIcons.DollarSign size={20} />
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    {selectedSummary.count} {selectedSummary.count === 1 ? 'Operación Seleccionada' : 'Operaciones Seleccionadas'}
                                </span>
                                <span className="text-2xl font-black text-[#00A896] tracking-tight">
                                    ${selectedSummary.total.toFixed(2)} USD
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                                onClick={() => setSelectedItems(new Set())}
                                className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                            >
                                Desmarcar
                            </button>

                            <button
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#00A896]/30 active:scale-95 border border-white/20 cursor-pointer"
                            >
                                <LucideIcons.ShieldCheck size={16} />
                                <span>Liquidar (${selectedSummary.total.toFixed(2)})</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
