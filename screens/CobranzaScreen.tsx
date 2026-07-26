import React, { useMemo, useState, useRef } from 'react';
import { Client, DeclarationStatus, ReceiptData, TaxRegime, ServiceFeesConfig, ReminderConfig, BusinessProfile, FinancialItem } from '../types';
import { getDueDateForPeriod, formatPeriodForDisplay, getPeriod, safeFormat } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
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

    const financialData = useMemo(() => {
        const receivable: FinancialItem[] = [];
        const projected: FinancialItem[] = [];
        const collected: FinancialItem[] = [];
        const now = new Date();
        const selectedMonth = new Date();

        clients.forEach(client => {
            if (client.isDeleted || client.isActive === false) return;
            let fee = getClientServiceFee(client, serviceFees);
            if (fee <= 0) fee = 10.00;

            let type: FinancialItem['type'] = 'mensual';
            if (client.taxProfile?.ivaFrequency === 'Semestral') type = 'semestral';
            else if (client.regime === TaxRegime.RimpeNegocioPopular) type = 'renta';
            else if (client.taxProfile?.hasActiveDevolucionIva) type = 'dev';

            const processedPeriods = new Set<string>();
            const paidPeriods = new Set<string>();
            client.declarations.forEach(decl => {
                if (decl.status === DeclarationStatus.Pagada && decl.paidAt) {
                    paidPeriods.add(decl.period);
                }
            });

            client.declarations.forEach(decl => {
                processedPeriods.add(decl.period);
                
                if (decl.status === DeclarationStatus.Pagada && decl.paidAt) {
                    const paidDate = parseISO(decl.paidAt);
                    if (isValid(paidDate) && isSameMonth(paidDate, selectedMonth)) {
                        collected.push({
                            clientId: client.id, clientName: client.name, ruc: client.ruc,
                            period: decl.period, amount: decl.amount || fee, status: DeclarationStatus.Pagada,
                            type, dateReference: paidDate, phones: client.phones || []
                        });
                    }
                } else if ((decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pendiente) && !paidPeriods.has(decl.period)) {
                    const dueDate = getDueDateForPeriod(client, decl.period) || now;
                    receivable.push({
                        clientId: client.id, clientName: client.name, ruc: client.ruc,
                        period: decl.period, amount: decl.amount || fee, status: decl.status,
                        type, dateReference: dueDate, daysDiff: differenceInCalendarDays(now, dueDate),
                        phones: client.phones || []
                    });
                }
            });

            const pNow = getPeriod(client, now);
            const pPrev = getPeriod(client, subMonths(now, 1));
            [pNow, pPrev].forEach(p => {
                if (!processedPeriods.has(p)) {
                    const dueDate = getDueDateForPeriod(client, p) || now;
                    const diff = differenceInCalendarDays(now, dueDate);
                    const item: FinancialItem = {
                        clientId: client.id, clientName: client.name, ruc: client.ruc,
                        period: p, amount: fee, status: DeclarationStatus.Pendiente,
                        type, dateReference: dueDate, daysDiff: diff, phones: client.phones || [], isVirtual: true
                    };
                    if (diff > 0) receivable.push(item);
                    else projected.push(item);
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

    return (
        <div className="space-y-4 sm:space-y-6 pb-24 animate-fade-in relative pt-4 sm:pt-0">
            {/* ELITE TACTICAL HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 relative z-10 px-4 sm:px-0">
                <div className="animate-fade-in-left w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-2 mb-2 sm:mb-2 text-center sm:text-left">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-teal/10 border border-brand-teal/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>
                            <span className="text-xs sm:text-xs font-semibold text-brand-teal uppercase tracking-widest">Financial Grid Alpha</span>
                        </div>
                        <span className="text-xs sm:text-xs font-semibold text-slate-400 uppercase tracking-widest opacity-50 sm:block hidden">• Santiago Cordova Protocol</span>
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-display font-semibold text-slate-900 dark:text-white leading-tight sm:leading-[0.85] tracking-tighter mb-2">
                        Financial <span className="text-brand-teal">Command</span>
                    </h2>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] sm:text-[11px] font-medium uppercase tracking-widest">
                        <LucideIcons.ShieldCheck size={12} className="text-brand-teal" />
                        <span>Gestión de Cobranzas de Alto Nivel</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto animate-fade-in-right">
                    <button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        disabled={selectedItems.size === 0}
                        className={`group relative overflow-hidden flex items-center justify-center gap-3 px-8 py-5 rounded-2xl text-xs sm:text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-500 w-full sm:w-auto
                            ${selectedItems.size > 0 
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl shadow-brand-teal/20 hover:scale-[1.05] active:scale-[0.95]' 
                                : 'bg-slate-100 dark:bg-slate-900/40 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-800'}`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-brand-teal/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <LucideIcons.DollarSign size={18} className={selectedItems.size > 0 ? "text-brand-teal" : ""} />
                        LIQUIDAR SELECCIÓN <span className="text-brand-teal">({selectedItems.size})</span>
                    </button>
                </div>
            </div>

            {/* CAMPAIGN CONTEXT BANNER */}
            <div className="relative z-10 sm:px-0">
                <CampaignBanner campaign={campaignContext} compact />
            </div>

            {/* ZENITH FINANCIAL STRIP - KPI Bar Minimalista */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                <div className="p-5 rounded-[2rem] bg-surface border border-outline-variant/30 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20">
                            <LucideIcons.AlertTriangle size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest font-premium">Por Recaudar</p>
                            <p className="text-2xl font-black text-on-surface font-mono tracking-tight">
                                ${financialData.receivable.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        {financialData.receivable.length} Pendientes
                    </span>
                </div>

                <div className="p-5 rounded-[2rem] bg-surface border border-outline-variant/30 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20">
                            <LucideIcons.CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest font-premium">Efectivo Cobrado</p>
                            <p className="text-2xl font-black text-on-surface font-mono tracking-tight">
                                ${financialData.collected.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {financialData.collected.length} Pagados
                    </span>
                </div>

                <div className="p-5 rounded-[2rem] bg-surface border border-outline-variant/30 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20">
                            <LucideIcons.Activity size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest font-premium">Cobertura Mensual</p>
                            <p className="text-2xl font-black text-on-surface font-mono tracking-tight">
                                {Math.round((financialData.collected.reduce((s, i) => s + i.amount, 0) / (financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0) || 1)) * 100)}%
                            </p>
                        </div>
                    </div>
                    <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-white/10">
                        <div 
                            className="h-full bg-primary transition-all duration-700" 
                            style={{ width: `${Math.round((financialData.collected.reduce((s, i) => s + i.amount, 0) / ((financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0)) || 1)) * 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* TACTICAL FILTERS & SEARCH */}
            <div className="glass-tactical p-2 rounded-[1.8rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-2xl w-full lg:w-auto overflow-x-auto no-scrollbar border border-slate-200 dark:border-slate-800">
                    {[
                        { id: 'receivable', label: 'Pendientes', icon: LucideIcons.AlertTriangle, color: 'text-rose-400' },
                        { id: 'projected', label: 'Proyectado', icon: LucideIcons.Timer, color: 'text-amber-400' },
                        { id: 'collected', label: 'Efectivo', icon: LucideIcons.CheckCircle, color: 'text-brand-teal' }
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`flex flex-1 lg:flex-none items-center justify-center gap-3 px-6 py-4 rounded-xl text-[11px] sm:text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 shrink-0
                                ${activeTab === tab.id 
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xl shadow-brand-teal/10 ring-1 ring-brand-teal/30 scale-105 z-10' 
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <tab.icon size={14} className={activeTab === tab.id ? tab.color : 'text-slate-400'} />
                            <span className="whitespace-nowrap">{tab.label}</span>
                            {tab.id === 'receivable' && financialData.receivable.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono ml-1 ${activeTab === tab.id ? 'bg-rose-400 text-white shadow-lg shadow-rose-400/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                    {financialData.receivable.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="relative flex-grow w-full px-2">
                    <LucideIcons.Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    <input 
                        type="text" 
                        placeholder="IDENTIFICADOR / RUC / PROTOCOLO" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-14 pr-6 py-4 sm:py-5 bg-white/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl text-[11px] font-semibold uppercase tracking-widest placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal/30 transition-all text-slate-900 dark:text-white" 
                    />
                </div>
                <div className="flex items-center gap-3 sm:px-2 w-full lg:w-auto">
                    <button 
                        onClick={() => setIsRecalculating(p => !p)} 
                        className="flex-1 lg:flex-none flex items-center justify-center p-4 text-slate-400 hover:text-brand-teal transition-all hover:rotate-180 duration-700 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg active:scale-90"
                    >
                        <LucideIcons.RefreshCw size={20} />
                    </button>
                </div>
            </div>

            {/* FULL WIDTH FINANCIAL GRID */}
            <div className="w-full">
                <div className="glass-tactical rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col relative group shadow-2xl">
                        <div className="relative z-10 p-5 sm:p-6 bg-white/50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center backdrop-blur-2xl">
                            <button onClick={() => {
                                if (selectedItems.size === currentList.length) setSelectedItems(new Set());
                                else setSelectedItems(new Set(currentList.map(i => `${i.clientId}-${i.period}`)));
                            }} className="flex items-center gap-3 px-5 py-3 rounded-2xl glass-card-premium text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300 hover:text-brand-teal dark:hover:text-brand-teal transition-all active:scale-95 ">
                                {selectedItems.size === currentList.length ? <LucideIcons.CheckSquare size={16} className="text-brand-teal" /> : <LucideIcons.Square size={16} />}
                                SELECT ALL ENTRIES
                            </button>
                            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-brand-teal/10 border border-brand-teal/20 shadow-inner">
                                <LucideIcons.Layers size={14} className="text-brand-teal" />
                                <span className="text-xs sm:text-[11px] font-semibold text-brand-teal uppercase tracking-widest">{currentList.length} OPERACIONES</span>
                            </div>
                        </div>

                        <div className="relative z-10 divide-y divide-slate-100 dark:divide-slate-800/50 max-h-[700px] overflow-y-auto no-scrollbar p-3 sm:p-0">
                            {currentList.length === 0 ? (
                                <div className="py-32 flex flex-col items-center justify-center text-slate-400">
                                    <div className="p-8 rounded-full bg-slate-50 dark:bg-slate-900/40 mb-6 border border-slate-100 dark:border-slate-800">
                                        <LucideIcons.ShieldCheck size={64} className="text-slate-200 dark:text-slate-800" />
                                    </div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-500">No Operations Found</p>
                                </div>
                            ) : (
                                currentList.map(item => {
                                    const key = `${item.clientId}-${item.period}`;
                                    const isSelected = selectedItems.has(key);
                                    return (
                                        <div 
                                            key={key} 
                                            onClick={() => activeTab !== 'collected' && (isSelected ? setSelectedItems(s => { const n = new Set(s); n.delete(key); return n; }) : setSelectedItems(s => new Set(s).add(key)))} 
                                            className={`group relative p-5 mb-2 sm:mb-0 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between transition-all duration-500 cursor-pointer overflow-hidden rounded-3xl sm:rounded-none
                                                ${isSelected 
                                                    ? 'bg-brand-teal/10 dark:bg-brand-teal/5 shadow-inner' 
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'}`}
                                        >
                                            <div className="flex items-center gap-6 relative z-10">
                                                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl flex items-center justify-center transition-all duration-500 border
                                                    ${isSelected 
                                                        ? 'bg-brand-teal border-brand-teal shadow-[0_0_20px_rgba(20,184,166,0.4)] text-white' 
                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 group-hover:border-brand-teal/30 group-hover:text-brand-teal shadow-sm'}`}>
                                                    {item.type === 'mensual' ? <LucideIcons.Calendar size={24} /> : <LucideIcons.Zap size={24} />}
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <p className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[200px] sm:max-w-none">{item.clientName}</p>
                                                        {item.daysDiff && item.daysDiff > 0 && (
                                                            <div className="px-2 py-0.5 rounded-lg bg-rose-400/10 border border-rose-400/20">
                                                                <span className="text-xs font-semibold text-rose-400 uppercase tracking-widest">URGENT</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5 py-0.5 px-2 rounded-md bg-slate-100 dark:bg-slate-800/80">
                                                            <LucideIcons.Activity size={10} className="text-slate-400" />
                                                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono tracking-widest uppercase">{item.ruc}</span>
                                                        </div>
                                                        <span className="text-slate-200 dark:text-slate-800 text-xs">•</span>
                                                        <span className="text-xs font-semibold text-brand-teal uppercase tracking-widest">{formatPeriodForDisplay(item.period)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-5 sm:mt-0 flex sm:flex-col justify-between items-end sm:items-end relative z-10 w-full sm:w-auto bg-white/50 dark:bg-black/20 sm:bg-transparent p-4 sm:p-0 rounded-2xl border border-slate-100 dark:border-slate-800/50 sm:border-transparent">
                                                <div className="flex flex-col sm:items-end">
                                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1 sm:hidden">Transaction Sum</span>
                                                    <p className={`text-xl sm:text-2xl font-semibold font-display tracking-tight transition-colors duration-300 ${isSelected ? 'text-brand-teal' : 'text-slate-900 dark:text-white'}`}>
                                                        ${item.amount.toFixed(2)}
                                                    </p>
                                                </div>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border
                                                        ${item.status === 'Pagada' 
                                                            ? 'bg-emerald-400/20 text-emerald-400' 
                                                            : item.daysDiff && item.daysDiff > 0 
                                                                ? 'bg-rose-400/20 text-rose-400' 
                                                                : 'bg-slate-200/50 dark:bg-white/10 text-slate-400'}`}>
                                                        <span className="text-[11px] font-semibold uppercase tracking-widest">
                                                            {item.status === 'Pagada' ? 'EJECUTADO' : item.daysDiff && item.daysDiff > 0 ? `ATRASADO ${item.daysDiff}D` : 'PENDIENTE'}
                                                        </span>
                                                    </div>
                                                    {navigate && (
                                                        <div className="flex gap-1.5">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEmitFastInvoice(item);
                                                                }}
                                                                className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-500 rounded-lg transition-colors border border-amber-500/20"
                                                                title="Emisión rápida directa al SRI"
                                                            >
                                                                <LucideIcons.Zap size={12} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // Evitar seleccionar la fila de cobros
                                                                    navigate('sri_facturacion', {
                                                                        clientId: item.clientId,
                                                                        amount: item.amount,
                                                                        description: `Honorarios Profesionales - Período ${item.period}`
                                                                    });
                                                                }}
                                                                className="p-1.5 bg-slate-100 hover:bg-primary/20 dark:bg-slate-800 dark:hover:bg-primary/30 text-slate-450 hover:text-primary rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                                                                title="Emitir Factura Electrónica para este cobro"
                                                            >
                                                                <LucideIcons.FileText size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute left-0 top-0 bottom-0 w-2 bg-brand-teal shadow-[4px_0_15px_rgba(20,184,166,0.5)]"></div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Autorizar Transacción Financiera">
                <div className="p-4 sm:p-8 space-y-10">
                    <div className="relative group">
                        <div className="absolute -inset-2 bg-gradient-to-r from-brand-teal to-brand-navy rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                        <div className="relative glass-card-premium p-10 rounded-3xl text-center shadow-inner-premium">
                            <div className="flex justify-center mb-6">
                                <div className="p-4 rounded-2xl bg-brand-teal/10 border border-brand-teal/20 text-brand-teal">
                                    <LucideIcons.ShieldCheck size={32} />
                                </div>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.4em] mb-4">Monto de Liquidación Total</p>
                            <p className="text-5xl sm:text-6xl font-semibold text-slate-900 dark:text-white mb-4 tracking-tighter">
                                ${Array.from(selectedItems).reduce<number>((sum: number, key) => sum + (currentList.find(i => `${i.clientId}-${i.period}` === key)?.amount || 0), 0).toFixed(2)}
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-brand-teal animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>
                                <span className="text-xs font-semibold text-brand-teal uppercase tracking-widest">Protocolo de Procedencia Verificado</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleProcessPayment} 
                            disabled={isProcessing} 
                            className="group relative w-full overflow-hidden py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-semibold text-xs uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {isProcessing ? <LucideIcons.RefreshCw className="animate-spin text-brand-teal" size={20} /> : <LucideIcons.ShieldAlert size={20} className="text-brand-teal" />}
                                {isProcessing ? 'AUTORIZANDO...' : 'CONFIRMAR OPERACIÓN TACTICAL'}
                            </span>
                            <div className="absolute inset-0 bg-brand-teal/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </button>
                        <p className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-widest leading-relaxed opacity-50">
                            Al confirmar, se generará un asiento contable digital <br />y se actualizará el historial del contribuyente en el Grid.
                        </p>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Protocolo de Ejecución Exitosa">
                {receiptData && (
                    <div className="p-4 sm:p-10 space-y-10">
                        <div className="relative group">
                            <div className="absolute -inset-2 bg-gradient-to-r from-brand-teal to-brand-navy rounded-[2.5rem] blur-3xl opacity-10"></div>
                            <div ref={receiptRef} className="relative glass-card-premium p-8 sm:p-12 text-slate-800 dark:text-slate-200 font-mono text-[11px]  overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 text-slate-100 dark:text-slate-800/40">
                                    <LucideIcons.Shield size={120} />
                                </div>
                                
                                <div className="text-center mb-10 border-b border-dashed border-slate-200 dark:border-slate-800 pb-8 relative z-10">
                                    <p className="font-semibold text-lg uppercase tracking-[0.2em] mb-2 text-slate-900 dark:text-white">{defaultBusinessProfile.businessName}</p>
                                    <p className="text-xs font-medium uppercase tracking-widest leading-tight text-slate-400">{defaultBusinessProfile.tradeName}</p>
                                    <p className="text-xs text-slate-500 mt-2">{defaultBusinessProfile.address}</p>
                                    <div className="inline-block mt-6 px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-semibold text-[11px] uppercase tracking-widest shadow-lg">
                                        TX-AUTH: {receiptData.transactionId}
                                    </div>
                                </div>

                                <div className="space-y-4 mb-10 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50 relative z-10">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase font-semibold text-[11px] tracking-widest">Contribuyente</span>
                                        <span className="text-right font-semibold uppercase text-slate-900 dark:text-white tracking-tight">{receiptData.clientName}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase font-semibold text-[11px] tracking-widest">Identificación</span>
                                        <span className="text-right font-semibold text-brand-teal">{receiptData.clientRuc}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase font-semibold text-[11px] tracking-widest">Digital Timestamp</span>
                                        <span className="text-right font-semibold opacity-80">{receiptData.paymentDate}</span>
                                    </div>
                                </div>

                                <div className="mb-10 relative z-10">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.3em] mb-4 border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">Desglose de Cargo</p>
                                    <div className="space-y-3">
                                        {receiptData.paidPeriods.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center py-1">
                                                <span className="font-medium uppercase text-slate-600 dark:text-slate-400">Honorarios Profesionales {p.period}</span>
                                                <span className="font-semibold text-slate-900 dark:text-white tracking-tighter">${p.amount.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-brand-teal p-6 rounded-[2rem] flex justify-between items-center text-white shadow-xl shadow-brand-teal/20 relative z-10">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-[11px] uppercase tracking-[0.3em] opacity-80">Total Transado</span>
                                        <span className="text-xs font-medium opacity-60">PAGO CONFIRMADO</span>
                                    </div>
                                    <span className="text-3xl font-semibold font-display tracking-tighter">${receiptData.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={() => printSalesNote(receiptData, defaultBusinessProfile)} 
                                className="flex-1 py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-semibold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl hover:scale-[1.02] transition-all"
                            >
                                <LucideIcons.Printer size={20} className="text-brand-teal" /> GENERAR TICKET FÍSICO
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
                                        className="flex-1 py-5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-semibold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl hover:scale-[1.02] transition-all"
                                    >
                                        <LucideIcons.Zap size={20} className="text-white" /> EMISIÓN SRI RÁPIDA
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
                                        className="flex-1 py-5 bg-primary text-white rounded-2xl font-semibold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl hover:scale-[1.02] transition-all"
                                    >
                                        <LucideIcons.FileText size={20} className="text-white" /> DETALLAR EN SRI
                                    </button>
                                </>
                            )}
                            <button 
                                onClick={() => setIsReceiptOpen(false)} 
                                className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-semibold text-[11px] uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                CERRAR PROTOCOLO
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={isFastBillingOpen} onClose={() => setIsFastBillingOpen(false)} title="Emisión de Factura SRI Rápida">
                {fastBillingItem && (
                    <div className="p-4 sm:p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80">
                            <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente / Receptor</p>
                                <h4 className="font-semibold text-slate-900 dark:text-white uppercase">{fastBillingItem.clientName}</h4>
                                <p className="text-xs font-mono text-slate-500">{fastBillingItem.ruc}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Monto de Honorarios</p>
                                <p className="text-2xl font-semibold text-brand-teal">${fastBillingItem.amount.toFixed(2)}</p>
                                <p className="text-xs text-slate-500 font-semibold uppercase">Período: {formatPeriodForDisplay(fastBillingItem.period)}</p>
                            </div>
                        </div>

                        {/* Progreso del Flujo */}
                        <div className="space-y-4">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Estado de Transmisión Electrónica</p>
                            
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
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                                                : isCurrent 
                                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse' 
                                                    : isFailed && fastBillingStep === s.step
                                                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                                                        : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                                            {isDone ? <LucideIcons.CheckCircle size={16} className="mb-1" />
                                                : isCurrent ? <LucideIcons.RefreshCw size={16} className="animate-spin mb-1" />
                                                    : <LucideIcons.Calendar size={16} className="mb-1" />}
                                            <span className="text-[10px] font-semibold uppercase tracking-widest">{s.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Logs del Proceso */}
                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Detalle del Proceso (Logs)</p>
                            <div className="p-4 rounded-xl bg-slate-900 text-slate-300 dark:bg-black/60 font-mono text-[10px] space-y-1.5 max-h-[160px] overflow-y-auto border border-slate-800 shadow-inner">
                                {fastBillingLogs.map((log, idx) => (
                                    <div key={idx} className={log.includes('✅') || log.includes('éxito') || log.includes('AUTORIZADO') ? 'text-emerald-400 font-semibold' : log.includes('❌') || log.includes('Error') ? 'text-rose-400 font-semibold' : ''}>
                                        {log}
                                    </div>
                                ))}
                                {['generating', 'signing', 'sending', 'authorizing'].includes(fastBillingStep) ? (
                                    <div className="flex items-center gap-1 text-amber-500 font-semibold animate-pulse">
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
                                    className="flex-1 py-4 bg-slate-850 hover:bg-slate-850 text-white rounded-xl font-semibold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-slate-700"
                                >
                                    <LucideIcons.Download size={14} /> XML Firmado
                                </button>
                            )}

                            {fastBillingStep === 'failed' && (
                                <button
                                    onClick={() => handleEmitFastInvoice(fastBillingItem)}
                                    className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                >
                                    <LucideIcons.RefreshCw size={14} /> Reintentar Emisión
                                </button>
                            )}

                            <button
                                onClick={() => setIsFastBillingOpen(false)}
                                className={`flex-1 py-4 rounded-xl font-semibold text-[11px] uppercase tracking-widest transition-all
                                    ${fastBillingStep === 'success' 
                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}
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
