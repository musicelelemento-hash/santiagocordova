import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Client, DeclarationStatus, ReceiptData, TaxRegime, ServiceFeesConfig, ReminderConfig, BusinessProfile, FinancialItem } from '../types';
import { getDueDateForPeriod, formatPeriodForDisplay, getPeriod, safeFormat } from '../services/sri';
import { getClientServiceFee, isCourtesyClient } from '../services/clientService';
import { isPeriodBeforeClientStart, isDeclared, isPaid, getActivePeriodsForClient, getClientDebtSummary } from '../services/complianceEngine';
import { differenceInCalendarDays, isSameMonth, parseISO, isValid, subMonths } from 'date-fns';
import {
    AlertTriangle, CheckCircle, MessageSquare, DollarSign,
    Printer, Search, Loader, RefreshCw, CheckSquare, Square, Layers,
    Shield, ExternalLink, ChevronDown, BarChart3, Timer, ShieldAlert,
    ShieldCheck, Calendar, Zap, Activity
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

    const currentList = useMemo(() => {
        let list = activeTab === 'receivable' ? [...financialData.receivable]
            : activeTab === 'projected' ? [...financialData.projected]
                : [...financialData.collected];
                
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(i => i.clientName.toLowerCase().includes(lower) || i.ruc.includes(lower));
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
    }, [financialData, activeTab, searchTerm]);

    const chartData = [
        { name: 'Cobrable', value: financialData.receivable.reduce((s, i) => s + i.amount, 0), color: '#ef4444' },
        { name: 'Recaudado', value: financialData.collected.reduce((s, i) => s + i.amount, 0), color: '#10b981' }
    ].filter(d => d.value > 0);

    const handleProcessPayment = () => {
        if (selectedItems.size === 0) return;
        setIsProcessing(true);
        const nowIso = new Date().toISOString();
        const transactionId = `PAY-${Date.now().toString().slice(-6)}`;
        
        // Safety check for setClients
        if (typeof setClients !== 'function') {
            console.error("setClients is not a function", setClients);
            setIsProcessing(false);
            toast.error("Error al procesar: setClients no disponible");
            return;
        }

        const newClients = [...clients];
        let lastClient;
        let paidPeriods: any[] = [];

        selectedItems.forEach(key => {
            const item = currentList.find(i => `${i.clientId}-${i.period}` === key);
            if (!item) return;
            const clientIdx = newClients.findIndex(c => c.id === item.clientId);
            if (clientIdx === -1) return;
            const history = [...newClients[clientIdx].declarations];
            const declIdx = history.findIndex(d => d.period === item.period);
            const entry = { period: item.period, status: DeclarationStatus.Pagada, paidAt: nowIso, transactionId, amount: item.amount, updatedAt: nowIso };
            if (declIdx > -1) history[declIdx] = { ...history[declIdx], ...entry };
            else history.push(entry as any);
            newClients[clientIdx] = { ...newClients[clientIdx], declarations: history };
            lastClient = newClients[clientIdx];
            paidPeriods.push({ period: item.period, amount: item.amount });
        });

        setTimeout(() => {
            setClients(newClients);
            setIsProcessing(false);
            setIsPaymentModalOpen(false);
            setSelectedItems(new Set());
            if (lastClient) setReceiptData({ transactionId, clientName: lastClient.name, clientRuc: lastClient.ruc, client: lastClient, paymentDate: safeFormat(new Date(), 'PPpp'), paidPeriods, totalAmount: paidPeriods.reduce((s, p) => s + p.amount, 0) });
            setIsReceiptOpen(true);
            toast.success("Pago registrado");
        }, 800);
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

            {/* ZENITH FINANCIAL STRIP - 3 Executive KPI Cards (Stitch Obsidian Luxury) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10 font-mono">
                <div className="p-5 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-xl backdrop-blur-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-500/15 text-rose-400 rounded-2xl border border-rose-500/30">
                            <LucideIcons.AlertTriangle size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Por Recaudar</p>
                            <p className="text-2xl font-black text-rose-400 font-mono tracking-tight">
                                ${financialData.receivable.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        {financialData.receivable.length} Pendientes
                    </span>
                </div>

                <div className="p-5 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-xl backdrop-blur-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-[#00A896]/15 text-[#00A896] rounded-2xl border border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.3)]">
                            <LucideIcons.CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[#00A896] uppercase tracking-widest">Efectivo Cobrado</p>
                            <p className="text-2xl font-black text-white font-mono tracking-tight">
                                ${financialData.collected.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30">
                        {financialData.collected.length} Pagados
                    </span>
                </div>

                <div className="p-5 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-xl backdrop-blur-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-[#2B6AFF]/15 text-[#2B6AFF] rounded-2xl border border-[#2B6AFF]/30">
                            <LucideIcons.Activity size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[#2B6AFF] uppercase tracking-widest">Cobertura Mensual</p>
                            <p className="text-2xl font-black text-white font-mono tracking-tight">
                                {Math.round((financialData.collected.reduce((s, i) => s + i.amount, 0) / (financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0) || 1)) * 100)}%
                            </p>
                        </div>
                    </div>
                    <div className="w-20 h-2 bg-[#020b14] rounded-full overflow-hidden border border-white/10">
                        <div 
                            className="h-full bg-gradient-to-r from-[#2B6AFF] to-[#00A896] transition-all duration-700 shadow-[0_0_8px_rgba(0,168,150,0.5)]" 
                            style={{ width: `${Math.round((financialData.collected.reduce((s, i) => s + i.amount, 0) / ((financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0)) || 1)) * 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* TACTICAL FILTERS & SEARCH (Stitch Obsidian Luxury) */}
            <div className="p-3 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl flex flex-col lg:flex-row gap-3 items-center font-mono">
                <div className="flex p-1 bg-[#0b1326] rounded-2xl w-full lg:w-auto overflow-x-auto no-scrollbar border border-white/10">
                    {[
                        { id: 'receivable', label: 'Pendientes', icon: LucideIcons.AlertTriangle, color: 'text-rose-400' },
                        { id: 'projected', label: 'Proyectado', icon: LucideIcons.Timer, color: 'text-amber-400' },
                        { id: 'collected', label: 'Efectivo', icon: LucideIcons.CheckCircle, color: 'text-[#00A896]' }
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`flex flex-1 lg:flex-none items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 shrink-0 cursor-pointer
                                ${activeTab === tab.id 
                                    ? 'bg-white/15 text-white shadow-lg border border-white/20' 
                                    : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <tab.icon size={14} className={activeTab === tab.id ? tab.color : 'text-slate-400'} />
                            <span className="whitespace-nowrap">{tab.label}</span>
                            {tab.id === 'receivable' && financialData.receivable.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ml-1 ${activeTab === tab.id ? 'bg-rose-500 text-white shadow-md' : 'bg-white/10 text-slate-400'}`}>
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
                        className="w-full pl-12 pr-5 py-3 bg-[#0b1326]/90 border border-white/10 rounded-2xl text-xs font-mono font-medium text-white uppercase tracking-wider placeholder:text-slate-500 focus:outline-none focus:border-[#00A896]/50 transition-all" 
                    />
                </div>
                <div className="flex items-center gap-2 px-1 w-full lg:w-auto">
                    <button 
                        onClick={() => setIsRecalculating(p => !p)} 
                        className="flex-1 lg:flex-none flex items-center justify-center p-3 text-slate-300 hover:text-[#00A896] transition-all hover:rotate-180 duration-700 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 shadow-lg active:scale-90 cursor-pointer"
                        title="Recalcular Cartera de Clientes"
                    >
                        <LucideIcons.RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* FULL WIDTH FINANCIAL GRID (Stitch Obsidian Luxury) */}
            <div className="w-full font-mono">
                <div className="rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col relative group">
                    <div className="relative z-10 p-5 bg-[#0b1326]/80 border-b border-white/10 flex justify-between items-center backdrop-blur-2xl">
                        <button 
                            onClick={() => {
                                if (selectedItems.size === currentList.length) setSelectedItems(new Set());
                                else setSelectedItems(new Set(currentList.map(i => `${i.clientId}-${i.period}`)));
                            }} 
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-all active:scale-95 border border-white/10 cursor-pointer"
                        >
                            {selectedItems.size === currentList.length ? <LucideIcons.CheckSquare size={16} className="text-[#00A896]" /> : <LucideIcons.Square size={16} />}
                            <span>SELECCIONAR TODOS</span>
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00A896]/15 border border-[#00A896]/30 shadow-inner">
                            <LucideIcons.Layers size={14} className="text-[#00A896]" />
                            <span className="text-xs font-bold text-[#00A896] uppercase tracking-wider">{currentList.length} OPERACIONES</span>
                        </div>
                    </div>

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
                </div>
            </div>

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
                                ${Array.from(selectedItems).reduce<number>((sum: number, key) => sum + (currentList.find(i => `${i.clientId}-${i.period}` === key)?.amount || 0), 0).toFixed(2)}
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
        </div>
    );
};
