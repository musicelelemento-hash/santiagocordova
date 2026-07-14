import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Plus, Trash2, Settings, CheckCircle2, XCircle, Info, Search, 
  Download, RefreshCw, Check, AlertTriangle, Globe, Activity, Wifi, WifiOff, 
  Copy, ExternalLink, Eye, ChevronRight, Play, Database, CreditCard, User, AlertCircle
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Client, TaxRegime } from '../types';

interface InvoiceItem {
  id: string;
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaRate: number; // e.g. 0.15, 0.00
  subtotal: number;
  iva: number;
  total: number;
}

interface WithholdingItem {
  id: string;
  baseImponible: number;
  codDocSustento: string; // e.g. "01"
  numDocSustento: string; // e.g. "001-001-000000001"
  fechaEmisionDocSustento: string;
  tipoRetencion: '1' | '2'; // 1 = Renta, 2 = IVA
  codigoRetencion: string; // e.g. "312", "343"
  porcentajeRetener: number; // e.g. 1.75, 10
  valorRetenido: number;
}

interface HistoricComprobante {
  id: string;
  tipo: 'factura' | 'retencion';
  secuencial: string;
  claveAcceso: string;
  rucReceptor: string;
  nombreReceptor: string;
  fechaEmision: string;
  total: number;
  estado: 'Generado' | 'Firmado' | 'Enviado' | 'Autorizado' | 'Rechazado' | 'Error';
  xml?: string;
  ambiente: '1' | '2';
}

const mapDescriptionToProduct = (desc: string) => {
  const cleanDesc = desc.toUpperCase();
  let code = '001';
  let formattedDesc = desc;

  // Extract period if present (e.g., "2026-01" or similar)
  let periodPart = '';
  const periodRegex = /(\d{4})-(\d{2})/;
  const match = desc.match(periodRegex);
  if (match) {
    const year = match[1];
    const month = parseInt(match[2], 10);
    const monthsEs = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    periodPart = ` ${monthsEs[month - 1]} ${year}`;
  } else {
    // Check if there is a semester (e.g. "2026-S1")
    const semMatch = desc.match(/(\d{4})-S(\d)/);
    if (semMatch) {
      periodPart = ` S${semMatch[2]} ${semMatch[1]}`;
    } else {
      // Check just a 4 digit year
      const yearMatch = desc.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        periodPart = ` ${yearMatch[1]}`;
      }
    }
  }

  if (cleanDesc.includes('IVA') || cleanDesc.includes('104')) {
    code = '002';
    formattedDesc = `Decl IVA${periodPart}`;
  } else if (cleanDesc.includes('RENTA') || cleanDesc.includes('102') || cleanDesc.includes('101')) {
    code = '003';
    formattedDesc = `Decl RENTA${periodPart}`;
  } else if (cleanDesc.includes('RETENCION') || cleanDesc.includes('RET') || cleanDesc.includes('103')) {
    code = '004';
    formattedDesc = `Decl RETENCIONES${periodPart}`;
  } else if (cleanDesc.includes('HONORARIOS') || cleanDesc.includes('ASESOR') || cleanDesc.includes('SERVICIOS') || cleanDesc.includes('COBRO')) {
    code = '001';
    formattedDesc = `Servicios Contables y Asesoría Tributaria${periodPart}`;
  }

  return { code, description: formattedDesc };
};

interface FacturacionSriScreenProps {
  initialClientId?: string | null;
  initialAmount?: number | null;
  initialDescription?: string | null;
  onClearInitialData?: () => void;
}

export const FacturacionSriScreen: React.FC<FacturacionSriScreenProps> = ({
  initialClientId,
  initialAmount,
  initialDescription,
  onClearInitialData
}) => {
  const { clients } = useAppStore();
  const [activeTab, setActiveTab] = useState<'emitir' | 'historial' | 'validador' | 'conexion'>('emitir');

  // API connection settings
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('sc_facturacion_api_url') || 'http://localhost:8000');
  const [apiPrefix, setApiPrefix] = useState('/api/v1');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  
  // Emisor Defaults (Ecuador Company Details)
  const [emisorRuc, setEmisorRuc] = useState('0705787745001');
  const [emisorRazonSocial, setEmisorRazonSocial] = useState('CORDOVA RAMIREZ ROBERTO SANTIGO');
  const [emisorNombreComercial, setEmisorNombreComercial] = useState('SOLUCIONES CONTABLES PRO');
  const [emisorDirMatriz, setEmisorDirMatriz] = useState('Colon y Sucre / Pasaje - El Oro');
  const [emisorEstab, setEmisorEstab] = useState('001');
  const [emisorPtoEmi, setEmisorPtoEmi] = useState('001');
  const [emisorRegimen, setEmisorRegimen] = useState('0'); // 0 = General, 1 = RIMPE Negocio Popular, 2 = RIMPE Emprendedor
  const [ambiente, setAmbiente] = useState<'1' | '2'>('1'); // 1 = Pruebas, 2 = Producción
  const [p12Password, setP12Password] = useState('ClaveFirma123');

  // Emission fields
  const [docType, setDocType] = useState<'factura' | 'retencion'>('factura');
  const [selectedClient, setSelectedClient] = useState<string>('');
  
  // Buyer / Subject Details
  const [buyerName, setBuyerName] = useState('');
  const [buyerRuc, setBuyerRuc] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerIdType, setBuyerIdType] = useState('05'); // 04 = RUC, 05 = Cédula, 06 = Pasaporte

  // Invoice specifics
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    {
      id: '1',
      codigoPrincipal: 'SERV-TRIB',
      descripcion: 'Asesoría Tributaria Mensual Profesional',
      cantidad: 1,
      precioUnitario: 120.00,
      ivaRate: 0.15,
      subtotal: 120.00,
      iva: 18.00,
      total: 138.00
    }
  ]);
  const [formaPago, setFormaPago] = useState('20'); // 01 = Sin sist. financiero, 20 = Con sist. financiero (transferencia/tarjeta)

  // Withholding specifics
  const [periodoFiscal, setPeriodoFiscal] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${mm}/${d.getFullYear()}`;
  });
  const [withholdings, setWithholdings] = useState<WithholdingItem[]>([
    {
      id: '1',
      baseImponible: 100.00,
      codDocSustento: '01',
      numDocSustento: '001-001-000004567',
      fechaEmisionDocSustento: new Date().toISOString().split('T')[0],
      tipoRetencion: '1', // Renta
      codigoRetencion: '343', // 10%
      porcentajeRetener: 10.0,
      valorRetenido: 10.0
    }
  ]);

  // Transmission workflow states
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2 | 3 | 4>(0); // 0=None, 1=XML, 2=Firmado, 3=Enviado, 4=Autorizado
  const [processStatus, setProcessStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [generatedXml, setGeneratedXml] = useState('');
  const [generatedJson, setGeneratedJson] = useState('');
  const [generatedAccessKey, setGeneratedAccessKey] = useState('');
  
  // Historical logs
  const [history, setHistory] = useState<HistoricComprobante[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ID Validator utility
  const [validationInput, setValidationInput] = useState('');
  const [validationResult, setValidationResult] = useState<{
    tested: boolean;
    valid: boolean;
    type: string;
    details: string[];
  } | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Check connection status to Laravel backend
  const checkBackendConnection = async (urlToCheck = apiUrl) => {
    setConnectionStatus('checking');
    try {
      const response = await fetch(`${urlToCheck}/`, { method: 'GET', mode: 'cors' });
      if (response.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (e) {
      setConnectionStatus('disconnected');
    }
  };

  useEffect(() => {
    checkBackendConnection();
  }, []);

  // Load history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sc_sri_comprobantes_history');
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // Load initial redirect parameters if coming from Cobros
  useEffect(() => {
    if (initialClientId) {
      setSelectedClient(initialClientId);
      setDocType('factura');
      setActiveTab('emitir');
      
      if (initialAmount) {
        const mapped = mapDescriptionToProduct(initialDescription || 'Honorarios por Servicios Contables');
        setInvoiceItems([
          {
            id: 'init-1',
            codigoPrincipal: mapped.code,
            descripcion: mapped.description,
            cantidad: 1,
            precioUnitario: initialAmount,
            ivaRate: 0.15,
            subtotal: initialAmount,
            iva: Number((initialAmount * 0.15).toFixed(2)),
            total: Number((initialAmount * 1.15).toFixed(2))
          }
        ]);
      }
      
      if (onClearInitialData) {
        onClearInitialData();
      }
    }
  }, [initialClientId, initialAmount, initialDescription, onClearInitialData]);

  // Auto-populate buyer details when client is selected
  useEffect(() => {
    if (selectedClient) {
      const client = clients.find(c => c.id === selectedClient);
      if (client) {
        setBuyerName(client.name);
        setBuyerRuc(client.ruc);
        setBuyerEmail(client.email || '');
        setBuyerPhone(client.phones?.[0] || '');
        setBuyerAddress(client.address || 'Quito, Ecuador');
        setBuyerIdType(client.ruc.length === 13 ? '04' : '05');
      }
    } else {
      setBuyerName('');
      setBuyerRuc('');
      setBuyerEmail('');
      setBuyerPhone('');
      setBuyerAddress('');
    }
  }, [selectedClient, clients]);

  // Standard withholding codes for Ecuador
  const withholdingCodes = {
    renta: [
      { code: '312', label: 'Servicios en relación de dependencia o generales (1.75%)', rate: 1.75 },
      { code: '343', label: 'Servicios profesionales de personas naturales (10.0%)', rate: 10.0 },
      { code: '307', label: 'Servicios de docencia/comisiones a profesionales (10.0%)', rate: 10.0 },
      { code: '332', label: 'Otras compras de bienes y servicios (1.75%)', rate: 1.75 },
      { code: '310', label: 'Servicio de transporte de carga (1.0%)', rate: 1.0 },
      { code: '320', label: 'Arrendamiento de bienes inmuebles (8.0%)', rate: 8.0 },
      { code: '344A', label: 'Régimen RIMPE Emprendedor (1.0%)', rate: 1.0 }
    ],
    iva: [
      { code: '1', label: 'Retención de IVA del 10% (Bienes a entes especiales)', rate: 10.0 },
      { code: '2', label: 'Retención de IVA del 20% (Servicios a entes especiales)', rate: 20.0 },
      { code: '3', label: 'Retención de IVA del 30% (Bienes generales)', rate: 30.0 },
      { code: '5', label: 'Retención de IVA del 50% (Servicios profesionales/Arriendos)', rate: 50.0 },
      { code: '7', label: 'Retención de IVA del 70% (Servicios generales)', rate: 70.0 },
      { code: '10', label: 'Retención de IVA del 100% (Importación de servicios / liquidaciones)', rate: 10.0 }
    ]
  };

  // Calculations for Invoice
  const invoiceTotals = useMemo(() => {
    let subtotal15 = 0;
    let subtotal0 = 0;
    let totalIva = 0;
    invoiceItems.forEach(item => {
      const itemSub = item.cantidad * item.precioUnitario;
      if (item.ivaRate > 0) {
        subtotal15 += itemSub;
        totalIva += itemSub * item.ivaRate;
      } else {
        subtotal0 += itemSub;
      }
    });
    const subtotal = subtotal15 + subtotal0;
    const total = subtotal + totalIva;
    return {
      subtotal15: Number(subtotal15.toFixed(2)),
      subtotal0: Number(subtotal0.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      iva: Number(totalIva.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  }, [invoiceItems]);

  // Calculations for Withholdings
  const withholdingTotal = useMemo(() => {
    return withholdings.reduce((sum, item) => sum + item.valorRetenido, 0);
  }, [withholdings]);

  // Invoice helper functions
  const addInvoiceItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      codigoPrincipal: 'SERV-NUEVO',
      descripcion: 'Detalle de servicio prestado',
      cantidad: 1,
      precioUnitario: 0.00,
      ivaRate: 0.15,
      subtotal: 0.00,
      iva: 0.00,
      total: 0.00
    };
    setInvoiceItems([...invoiceItems, newItem]);
  };

  const removeInvoiceItem = (id: string) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems(invoiceItems.filter(item => item.id !== id));
    }
  };

  const updateInvoiceItem = (id: string, field: keyof InvoiceItem, val: any) => {
    setInvoiceItems(invoiceItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: val };
        // Recalculate
        const sub = updated.cantidad * updated.precioUnitario;
        updated.subtotal = Number(sub.toFixed(2));
        updated.iva = Number((sub * updated.ivaRate).toFixed(2));
        updated.total = Number((updated.subtotal + updated.iva).toFixed(2));
        return updated;
      }
      return item;
    }));
  };

  // Withholding helper functions
  const addWithholdingRow = () => {
    const newRow: WithholdingItem = {
      id: Date.now().toString(),
      baseImponible: 0.00,
      codDocSustento: '01',
      numDocSustento: '001-001-000000001',
      fechaEmisionDocSustento: new Date().toISOString().split('T')[0],
      tipoRetencion: '1',
      codigoRetencion: '312',
      porcentajeRetener: 1.75,
      valorRetenido: 0.00
    };
    setWithholdings([...withholdings, newRow]);
  };

  const removeWithholdingRow = (id: string) => {
    if (withholdings.length > 1) {
      setWithholdings(withholdings.filter(w => w.id !== id));
    }
  };

  const updateWithholdingRow = (id: string, field: keyof WithholdingItem, val: any) => {
    setWithholdings(withholdings.map(w => {
      if (w.id === id) {
        const updated = { ...w, [field]: val };

        // Handle type / code changes
        if (field === 'tipoRetencion') {
          const defaultList = val === '1' ? withholdingCodes.renta : withholdingCodes.iva;
          updated.codigoRetencion = defaultList[0].code;
          updated.porcentajeRetener = defaultList[0].rate;
        } else if (field === 'codigoRetencion') {
          const list = updated.tipoRetencion === '1' ? withholdingCodes.renta : withholdingCodes.iva;
          const matched = list.find(x => x.code === val);
          if (matched) {
            updated.porcentajeRetener = matched.rate;
          }
        }

        // Recalculate withheld value
        const rateCoeff = updated.porcentajeRetener / 100;
        updated.valorRetenido = Number((updated.baseImponible * rateCoeff).toFixed(2));

        return updated;
      }
      return w;
    }));
  };

  // Log message helper
  const addLog = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    let prefix = 'ℹ️';
    if (type === 'success') prefix = '✅';
    if (type === 'warn') prefix = '⚠️';
    if (type === 'error') prefix = '❌';
    setConsoleLogs(prev => [...prev, `[${timestamp}] ${prefix} ${msg}`]);
  };

  // Generate Access Key manually/automatically
  const generateAccessKeyEcuador = (
    fecha: string, // YYYY-MM-DD
    tipoComp: string, // e.g. "01" (Factura), "07" (Retencion)
    ruc: string,
    amb: string,
    estab: string,
    pto: string,
    sec: string,
    codNumerico = '12345678',
    tipoEmi = '1'
  ) => {
    const cleanFecha = fecha.replace(/-/g, ''); // DDMMYYYY format expected by SRI
    const d = cleanFecha.substring(8, 10) + cleanFecha.substring(5, 7) + cleanFecha.substring(0, 4); // "01062026"
    
    // access key construction:
    // Fecha (8) + TipoComp (2) + RUC (13) + Ambiente (1) + Serie (6) + Secuencial (9) + Código Numérico (8) + Tipo Emision (1) = 48 digits
    const baseKey = d + tipoComp + ruc + amb + estab + pto + sec.padStart(9, '0') + codNumerico.padStart(8, '0') + tipoEmi;
    
    // Modulo 11 check digit
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

    return baseKey + checkDigit;
  };

  // Run the full invoicing workflow (Generate, Sign, Send, Authorize)
  const handleProcessDocument = async () => {
    setProcessStatus('running');
    setConsoleLogs([]);
    setGeneratedXml('');
    setGeneratedJson('');
    setCurrentStep(1);

    const isMock = connectionStatus !== 'connected';
    
    addLog(`Iniciando proceso de emisión de ${docType === 'factura' ? 'Factura' : 'Retención'}...`);
    addLog(`Ambiente: ${ambiente === '1' ? '1 (PRUEBAS)' : '2 (PRODUCCIÓN)'}. Modo: ${isMock ? 'SIMULACIÓN DEMO' : 'API LARAVEL CONECTADA'}`);

    // Formulate payload
    const secuencial = String(history.length + 1).padStart(9, '0');
    const todayStr = new Date().toISOString().split('T')[0];
    const key = generateAccessKeyEcuador(
      todayStr,
      docType === 'factura' ? '01' : '07',
      emisorRuc,
      ambiente,
      emisorEstab,
      emisorPtoEmi,
      secuencial
    );
    setGeneratedAccessKey(key);

    let payload: any = {
      tipo: docType,
      data: {
        infoTributaria: {
          ambiente,
          tipoEmision: '1',
          razonSocial: emisorRazonSocial,
          nombreComercial: emisorNombreComercial,
          ruc: emisorRuc,
          claveAcceso: key,
          codDoc: docType === 'factura' ? '01' : '07',
          estab: emisorEstab,
          ptoEmi: emisorPtoEmi,
          secuencial,
          dirMatriz: emisorDirMatriz,
          regimen: emisorRegimen
        },
        infoAdicional: {
          telefono: buyerPhone || '0999999999',
          email: buyerEmail || 'cliente@example.com',
          direccion: buyerAddress
        }
      }
    };

    if (docType === 'factura') {
      payload.data.infoFactura = {
        fechaEmision: todayStr.split('-').reverse().join('/'), // DD/MM/YYYY
        dirEstablecimiento: emisorDirMatriz,
        obligadoContabilidad: 'NO',
        tipoIdentificacionComprador: buyerIdType,
        razonSocialComprador: buyerName,
        identificacionComprador: buyerRuc,
        totalSinImpuestos: invoiceTotals.subtotal.toFixed(2),
        totalDescuento: '0.00',
        totalImpuesto: [
          {
            codigo: '2', // IVA
            codigoPorcentaje: '4', // 15% (Ecuador)
            baseImponible: invoiceTotals.subtotal15.toFixed(2),
            valor: invoiceTotals.iva.toFixed(2)
          }
        ],
        propina: '0.00',
        importeTotal: invoiceTotals.total.toFixed(2),
        moneda: 'DOLAR',
        pagos: {
          formaPago,
          total: invoiceTotals.total.toFixed(2)
        }
      };
      payload.data.detalle = invoiceItems.map(item => ({
        codigoPrincipal: item.codigoPrincipal,
        codigoAuxiliar: item.codigoPrincipal,
        descripcion: item.descripcion,
        cantidad: item.cantidad.toFixed(2),
        precioUnitario: item.precioUnitario.toFixed(2),
        descuento: '0.00',
        precioTotalSinImpuesto: item.subtotal.toFixed(2),
        impuesto: {
          codigo: '2',
          codigoPorcentaje: item.ivaRate > 0 ? '4' : '0',
          tarifa: item.ivaRate > 0 ? '15' : '0',
          baseImponible: item.subtotal.toFixed(2),
          valor: item.iva.toFixed(2)
        }
      }));
    } else {
      // Retencion
      payload.data.infoCompRetencion = {
        fechaEmision: todayStr.split('-').reverse().join('/'),
        dirEstablecimiento: emisorDirMatriz,
        obligadoContabilidad: 'NO',
        tipoIdentificacionSujetoRetenido: buyerIdType,
        razonSocialSujetoRetenido: buyerName,
        identificacionSujetoRetenido: buyerRuc,
        periodoFiscal
      };
      payload.data.impuestos = withholdings.map(w => ({
        codigo: w.tipoRetencion, // 1 = Renta, 2 = IVA
        codigoRetencion: w.codigoRetencion,
        baseImponible: w.baseImponible.toFixed(2),
        porcentajeRetener: w.porcentajeRetener.toFixed(2),
        valorRetenido: w.valorRetenido.toFixed(2),
        codDocSustento: w.codDocSustento,
        numDocSustento: w.numDocSustento.replace(/-/g, ''),
        fechaEmisionDocSustento: w.fechaEmisionDocSustento.split('-').reverse().join('/')
      }));
    }

    setGeneratedJson(JSON.stringify(payload, null, 2));

    // Wait a brief delay for realism in logs
    await new Promise(r => setTimeout(r, 800));

    try {
      let currentXml = '';
      
      // Step 1: Generate XML
      addLog(`Generando estructura de XML comprobante en base al payload JSON...`);
      if (isMock) {
        currentXml = `<?xml version="1.0" encoding="UTF-8"?>
<${docType} id="comprobante" version="1.0.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${emisorRazonSocial}</razonSocial>
    <nombreComercial>${emisorNombreComercial}</nombreComercial>
    <ruc>${emisorRuc}</ruc>
    <claveAcceso>${key}</claveAcceso>
    <codDoc>${docType === 'factura' ? '01' : '07'}</codDoc>
    <estab>${emisorEstab}</estab>
    <ptoEmi>${emisorPtoEmi}</ptoEmi>
    <secuencial>${secuencial}</secuencial>
    <dirMatriz>${emisorDirMatriz}</dirMatriz>
  </infoTributaria>
  <!-- Información del comprobante y detalles del receptor -->
  <!-- Detalles del producto y tributos -->
</${docType}>`;
        setGeneratedXml(currentXml);
        addLog(`XML generado correctamente (SIMULADO: ${currentXml.length} bytes)`, 'success');
      } else {
        const response = await fetch(`${apiUrl}${apiPrefix}/facturacion/xml`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Error en API al generar XML: ${response.statusText}`);
        const data = await response.json();
        currentXml = data.xml;
        setGeneratedXml(currentXml);
        addLog(`XML generado correctamente en el backend (${currentXml.length} bytes)`, 'success');
      }

      // Step 2: Sign XML
      setCurrentStep(2);
      await new Promise(r => setTimeout(r, 1000));
      addLog(`Firmando XML digitalmente usando XAdES-BES...`);
      addLog(`Cargando archivo de firma P12...`);

      if (isMock) {
        currentXml = currentXml.replace('</infoTributaria>', `</infoTributaria>\n  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">\n    <SignedInfo>\n      <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>\n      <!-- Simulación de firma XAdES-BES digital -->\n      <SignatureValue>MIIEuwYJKoZIhvcNAQcCoIIErDCC...</SignatureValue>\n    </SignedInfo>\n  </Signature>`);
        setGeneratedXml(currentXml);
        addLog(`Firma digital XAdES-BES realizada exitosamente (SIMULADA)`, 'success');
      } else {
        // Sign endpoint
        const signResponse = await fetch(`${apiUrl}${apiPrefix}/facturacion/firmar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: docType,
            xml: currentXml,
            clave_certificado: p12Password
          })
        });
        if (!signResponse.ok) throw new Error(`Error en API al firmar: ${signResponse.statusText}`);
        const signData = await signResponse.json();
        currentXml = signData.xml_firmado || signData.xml;
        setGeneratedXml(currentXml);
        addLog(`Firma digital realizada con éxito por el backend`, 'success');
      }

      // Step 3: Send to SRI
      setCurrentStep(3);
      await new Promise(r => setTimeout(r, 1200));
      addLog(`Conectándose con el Web Service del SRI (${ambiente === '1' ? 'PRUEBAS: celcer.sri.gob.ec' : 'PRODUCCIÓN: cel.sri.gob.ec'})...`);
      addLog(`Enviando XML firmado a recepción...`);

      if (isMock) {
        addLog(`Respuesta del SRI Recepción: RECIBIDA`, 'success');
        addLog(`Estado de recepción: DEVUELTA / RECIBIDO`);
      } else {
        const sendResponse = await fetch(`${apiUrl}${apiPrefix}/facturacion/sri/enviar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            xml_firmado: currentXml,
            ambiente
          })
        });
        if (!sendResponse.ok) throw new Error(`Fallo de conexión al SRI: ${sendResponse.statusText}`);
        const sendData = await sendResponse.json();
        addLog(`Respuesta Recepción SRI: ${JSON.stringify(sendData.respuesta || sendData)}`, 'success');
      }

      // Step 4: Authorize
      setCurrentStep(4);
      await new Promise(r => setTimeout(r, 1500));
      addLog(`Solicitando autorización de comprobante para clave de acceso: ${key}...`);

      if (isMock) {
        addLog(`Comprobante AUTORIZADO por el SRI el ${new Date().toLocaleString()}`, 'success');
        addLog(`Número de autorización: ${key}`);
        setProcessStatus('success');

        // Add to history
        const newRecord: HistoricComprobante = {
          id: Date.now().toString(),
          tipo: docType,
          secuencial,
          claveAcceso: key,
          rucReceptor: buyerRuc,
          nombreReceptor: buyerName,
          fechaEmision: todayStr,
          total: docType === 'factura' ? invoiceTotals.total : withholdingTotal,
          estado: 'Autorizado',
          xml: currentXml,
          ambiente
        };

        const updatedHistory = [newRecord, ...history];
        setHistory(updatedHistory);
        localStorage.setItem('sc_sri_comprobantes_history', JSON.stringify(updatedHistory));
      } else {
        const authResponse = await fetch(`${apiUrl}${apiPrefix}/facturacion/sri/autorizar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clave_acceso: key,
            ambiente
          })
        });
        if (!authResponse.ok) throw new Error(`Fallo consulta autorización: ${authResponse.statusText}`);
        const authData = await authResponse.json();
        
        addLog(`Respuesta Autorización SRI: ${JSON.stringify(authData.respuesta || authData)}`, 'success');
        
        const isAuthorized = authData.status || authData.estado === 'AUTORIZADO';
        setProcessStatus(isAuthorized ? 'success' : 'failed');

        const newRecord: HistoricComprobante = {
          id: Date.now().toString(),
          tipo: docType,
          secuencial,
          claveAcceso: key,
          rucReceptor: buyerRuc,
          nombreReceptor: buyerName,
          fechaEmision: todayStr,
          total: docType === 'factura' ? invoiceTotals.total : withholdingTotal,
          estado: isAuthorized ? 'Autorizado' : 'Error',
          xml: currentXml,
          ambiente
        };
        const updatedHistory = [newRecord, ...history];
        setHistory(updatedHistory);
        localStorage.setItem('sc_sri_comprobantes_history', JSON.stringify(updatedHistory));
      }

    } catch (err: any) {
      addLog(`Error en el flujo: ${err.message}`, 'error');
      setProcessStatus('failed');
    }
  };

  // Perform ID check
  const handleValidateId = () => {
    const value = validationInput.trim();
    if (!value) {
      setValidationResult(null);
      return;
    }

    const details: string[] = [];
    let isValid = false;
    let typeText = 'Desconocido';

    if (value.length !== 10 && value.length !== 13) {
      setValidationResult({
        tested: true,
        valid: false,
        type: 'Error de longitud',
        details: ['La identificación ecuatoriana debe tener 10 dígitos (Cédula) o 13 dígitos (RUC).']
      });
      return;
    }

    if (!/^\d+$/.test(value)) {
      setValidationResult({
        tested: true,
        valid: false,
        type: 'Formato no numérico',
        details: ['La identificación debe contener únicamente números del 0 al 9.']
      });
      return;
    }

    const provCode = parseInt(value.substring(0, 2), 10);
    if (provCode < 1 || (provCode > 24 && provCode !== 30)) {
      details.push(`Código de provincia inicial '${provCode}' es inválido (Debe estar entre 01 y 24, o 30 para el extranjero).`);
    } else {
      details.push(`Código de provincia '${provCode}' es válido.`);
    }

    const thirdDigit = parseInt(value[2], 10);
    details.push(`Tercer dígito es '${thirdDigit}'.`);

    if (thirdDigit < 6) {
      typeText = value.length === 13 ? 'RUC Persona Natural' : 'Cédula de Identidad';
      details.push(`Tipo de entidad: Persona Natural o Cédula (Módulo 10).`);
      
      const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
      let total = 0;
      for (let i = 0; i < 9; i++) {
        let val = parseInt(value[i], 10) * coefficients[i];
        if (val > 9) val -= 9;
        total += val;
      }
      const checkDigit = parseInt(value[9], 10);
      const computed = (10 - (total % 10)) % 10;
      isValid = checkDigit === computed;
      
      details.push(`Suma acumulada del módulo 10: ${total}.`);
      details.push(`Dígito verificador esperado: ${computed}. Dígito provisto: ${checkDigit}.`);
    } else if (thirdDigit === 6) {
      typeText = 'RUC Institución Pública';
      details.push(`Tipo de entidad: Institución Pública (Módulo 11).`);
      
      const coefficients = [3, 2, 7, 6, 5, 4, 3, 2];
      let total = 0;
      for (let i = 0; i < 8; i++) {
        total += parseInt(value[i], 10) * coefficients[i];
      }
      const checkDigit = parseInt(value[8], 10);
      const computed = (11 - (total % 11)) % 11;
      isValid = checkDigit === computed;
      
      details.push(`Suma acumulada del módulo 11 (Pública): ${total}.`);
      details.push(`Dígito verificador esperado: ${computed}. Dígito provisto: ${checkDigit}.`);
    } else if (thirdDigit === 9) {
      typeText = 'RUC Sociedad Privada';
      details.push(`Tipo de entidad: Sociedad Privada o Extranjero (Módulo 11).`);
      
      const coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2];
      let total = 0;
      for (let i = 0; i < 9; i++) {
        total += parseInt(value[i], 10) * coefficients[i];
      }
      const checkDigit = parseInt(value[9], 10);
      const computed = (11 - (total % 11)) % 11;
      isValid = checkDigit === computed;
      
      details.push(`Suma acumulada del módulo 11 (Sociedad): ${total}.`);
      details.push(`Dígito verificador esperado: ${computed}. Dígito provisto: ${checkDigit}.`);
    }

    if (value.length === 13 && !value.endsWith('001')) {
      details.push("ERROR: El RUC debe finalizar con el establecimiento '001'.");
      isValid = false;
    }

    setValidationResult({
      tested: true,
      valid: isValid && provCode >= 1 && (provCode <= 24 || provCode === 30),
      type: typeText,
      details
    });
  };

  // Filter history
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchSearch = 
        item.nombreReceptor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.rucReceptor.includes(searchTerm) ||
        item.claveAcceso.includes(searchTerm);
      
      const matchStatus = statusFilter === 'all' || item.estado === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [history, searchTerm, statusFilter]);

  const downloadXmlFile = (comprobante: HistoricComprobante) => {
    if (!comprobante.xml) return;
    const blob = new Blob([comprobante.xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${comprobante.tipo}-${comprobante.secuencial}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, subject: string) => {
    navigator.clipboard.writeText(text);
    alert(`${subject} copiado al portapapeles.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Top Banner Status */}
      <div className="glass-card-premium p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <FileText size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
              Facturación Electrónica SRI Ecuador
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Genera comprobantes XML, realiza firmas electrónicas con estándares XAdES-BES y transmite al SRI localmente.
            </p>
          </div>
        </div>

        {/* Connection Widget */}
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
          connectionStatus === 'connected' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : connectionStatus === 'checking'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
        }`}>
          {connectionStatus === 'connected' ? (
            <>
              <Wifi size={16} className="animate-pulse" />
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider font-premium">API Online</span>
                <span className="text-[9px] font-mono opacity-80">{apiUrl}</span>
              </div>
            </>
          ) : connectionStatus === 'checking' ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-xs font-black uppercase tracking-wider font-premium">Verificando...</span>
            </>
          ) : (
            <>
              <WifiOff size={16} />
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider font-premium">Simulación Activa</span>
                <span className="text-[9px] opacity-80">Backend Laravel Offline</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-px">
        {[
          { id: 'emitir', label: 'Emitir Comprobante', icon: Play },
          { id: 'historial', label: 'Historial / Archivo', icon: Database },
          { id: 'validador', label: 'Validador RUC/Cédula', icon: CheckCircle2 },
          { id: 'conexion', label: 'Conexión & Emisor', icon: Settings }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider font-premium border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: EMISION DE COMPROBANTES */}
      {activeTab === 'emitir' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel - Form */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Header selection card */}
            <div className="glass-card-premium p-6 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Tipo de Documento y Receptor</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDocType('factura')}
                  className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-black uppercase tracking-wider font-premium transition-all ${
                    docType === 'factura'
                      ? 'bg-primary text-white border-primary shadow-primary'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <FileText size={16} />
                  Factura (01)
                </button>
                <button
                  type="button"
                  onClick={() => setDocType('retencion')}
                  className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-black uppercase tracking-wider font-premium transition-all ${
                    docType === 'retencion'
                      ? 'bg-primary text-white border-primary shadow-primary'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard size={16} />
                  Retención (07)
                </button>
              </div>

              {/* Client Auto-complete Selector */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Autocompletar desde Clientes
                </label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary transition-all font-semibold"
                >
                  <option value="">-- SELECCIONE CLIENTE PARA AUTOCOMPLETAR --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.ruc})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Receptor Data Form */}
            <div className="glass-card-premium p-6 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Datos del Receptor / Sujeto Retenido</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Razón Social</label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-semibold"
                    placeholder="Nombres completos o Razón Social"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Identificación</label>
                  <input
                    type="text"
                    value={buyerRuc}
                    onChange={(e) => setBuyerRuc(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-mono font-semibold"
                    placeholder="Cédula o RUC"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Tipo Identificación</label>
                  <select
                    value={buyerIdType}
                    onChange={(e) => setBuyerIdType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-semibold"
                  >
                    <option value="05">05 - CÉDULA</option>
                    <option value="04">04 - RUC</option>
                    <option value="06">06 - PASAPORTE</option>
                    <option value="07">07 - CONSUMIDOR FINAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Email Receptor</label>
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-semibold"
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-semibold"
                    placeholder="0999999999"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={buyerAddress}
                    onChange={(e) => setBuyerAddress(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-semibold"
                    placeholder="Dirección del receptor"
                  />
                </div>
              </div>
            </div>

            {/* Document Details - Factura specific */}
            {docType === 'factura' && (
              <div className="glass-card-premium p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Detalles de Factura</h3>
                  <button
                    type="button"
                    onClick={addInvoiceItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider font-premium transition-all"
                  >
                    <Plus size={12} />
                    Agregar Ítem
                  </button>
                </div>

                {/* Items Grid */}
                <div className="space-y-3">
                  {invoiceItems.map((item) => (
                    <div key={item.id} className="p-4 bg-slate-100/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-xl space-y-3 relative group">
                      {invoiceItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInvoiceItem(item.id)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pr-6">
                        <div className="md:col-span-3">
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Cód. Principal</label>
                          <input
                            type="text"
                            value={item.codigoPrincipal}
                            onChange={(e) => updateInvoiceItem(item.id, 'codigoPrincipal', e.target.value)}
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold"
                          />
                        </div>
                        <div className="md:col-span-9">
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Descripción del Artículo</label>
                          <input
                            type="text"
                            value={item.descripcion}
                            onChange={(e) => updateInvoiceItem(item.id, 'descripcion', e.target.value)}
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Cantidad</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.cantidad}
                            onChange={(e) => updateInvoiceItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">P. Unitario</label>
                          <input
                            type="number"
                            min="0.00"
                            step="0.01"
                            value={item.precioUnitario}
                            onChange={(e) => updateInvoiceItem(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Tarifa IVA</label>
                          <select
                            value={item.ivaRate}
                            onChange={(e) => updateInvoiceItem(item.id, 'ivaRate', parseFloat(e.target.value))}
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold"
                          >
                            <option value="0.15">15% IVA</option>
                            <option value="0.00">0% IVA</option>
                          </select>
                        </div>
                        <div className="col-span-3 md:col-span-1">
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Total Ítem</label>
                          <div className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-200/50 dark:bg-slate-900/50 rounded-lg text-xs font-mono font-bold text-right text-slate-600 dark:text-slate-300">
                            ${item.total.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals and Payment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-white/10">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Forma de Pago</label>
                      <select
                        value={formaPago}
                        onChange={(e) => setFormaPago(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-semibold"
                      >
                        <option value="01">01 - Sin Utilización del Sistema Financiero</option>
                        <option value="20">20 - Con Utilización del Sistema Financiero (Transferencias/Tarjetas)</option>
                        <option value="19">19 - Tarjeta de Crédito</option>
                        <option value="17">17 - Dinero Electrónico</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-500">
                      <span>Subtotal 15% IVA:</span>
                      <span className="font-mono">${invoiceTotals.subtotal15.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-slate-500">
                      <span>Subtotal 0% IVA:</span>
                      <span className="font-mono">${invoiceTotals.subtotal0.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-slate-500">
                      <span>IVA 15%:</span>
                      <span className="font-mono">${invoiceTotals.iva.toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-white/10 my-1"></div>
                    <div className="flex justify-between text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider font-premium">
                      <span>Importe Total:</span>
                      <span className="font-mono text-primary">${invoiceTotals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Document Details - Retencion specific */}
            {docType === 'retencion' && (
              <div className="glass-card-premium p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Detalles de Retención</h3>
                  <button
                    type="button"
                    onClick={addWithholdingRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider font-premium transition-all"
                  >
                    <Plus size={12} />
                    Agregar Línea
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Periodo Fiscal (MM/AAAA)</label>
                    <input
                      type="text"
                      value={periodoFiscal}
                      onChange={(e) => setPeriodoFiscal(e.target.value)}
                      placeholder="e.g. 07/2026"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-mono font-semibold"
                    />
                  </div>
                </div>

                {/* Withholdings Rows */}
                <div className="space-y-4 pt-2">
                  {withholdings.map((w) => (
                    <div key={w.id} className="p-4 bg-slate-100/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-xl space-y-4 relative group">
                      {withholdings.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWithholdingRow(w.id)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Tipo Documento Sustento</label>
                          <select
                            value={w.codDocSustento}
                            onChange={(e) => updateWithholdingRow(w.id, 'codDocSustento', e.target.value)}
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold"
                          >
                            <option value="01">01 - FACTURA</option>
                            <option value="02">02 - NOTA DE VENTA</option>
                            <option value="03">03 - LIQUIDACIÓN DE COMPRA</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Num. Doc Sustento</label>
                          <input
                            type="text"
                            value={w.numDocSustento}
                            onChange={(e) => updateWithholdingRow(w.id, 'numDocSustento', e.target.value)}
                            placeholder="001-001-000000001"
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Fecha Emisión Doc</label>
                          <input
                            type="date"
                            value={w.fechaEmisionDocSustento}
                            onChange={(e) => updateWithholdingRow(w.id, 'fechaEmisionDocSustento', e.target.value)}
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-2">
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Impuesto</label>
                          <select
                            value={w.tipoRetencion}
                            onChange={(e) => updateWithholdingRow(w.id, 'tipoRetencion', e.target.value)}
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold"
                          >
                            <option value="1">RENTA (1)</option>
                            <option value="2">IVA (2)</option>
                          </select>
                        </div>

                        <div className="md:col-span-5">
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Código de Retención</label>
                          <select
                            value={w.codigoRetencion}
                            onChange={(e) => updateWithholdingRow(w.id, 'codigoRetencion', e.target.value)}
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold truncate"
                          >
                            {(w.tipoRetencion === '1' ? withholdingCodes.renta : withholdingCodes.iva).map(opt => (
                              <option key={opt.code} value={opt.code}>{opt.code} - {opt.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Base Imp.</label>
                          <input
                            type="number"
                            step="0.01"
                            value={w.baseImponible}
                            onChange={(e) => updateWithholdingRow(w.id, 'baseImponible', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-semibold font-mono"
                          />
                        </div>

                        <div className="md:col-span-1">
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Tasa %</label>
                          <div className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-200/40 dark:bg-slate-900/40 rounded-lg text-xs font-semibold font-mono text-center">
                            {w.porcentajeRetener}%
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Val. Retenido</label>
                          <div className="w-full px-2.5 py-1.5 mt-0.5 bg-slate-200/50 dark:bg-slate-900/50 rounded-lg text-xs font-mono font-bold text-right text-slate-600 dark:text-slate-300">
                            ${w.valorRetenido.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Withheld Block */}
                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-white/10">
                  <div className="bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 rounded-2xl p-4 w-full md:w-80 flex justify-between items-center">
                    <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider font-premium">Total Retenido:</span>
                    <span className="text-lg font-mono font-black text-primary">${withholdingTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Workflow Control steps */}
            <div className="glass-card-premium p-6 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Ciclo de Emisión SRI</h3>
              
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { step: 1, label: 'XML Generado', desc: 'Estructura' },
                  { step: 2, label: 'Firmado', desc: 'XAdES-BES' },
                  { step: 3, label: 'Enviado SRI', desc: 'Recepción' },
                  { step: 4, label: 'Autorizado', desc: 'SRI Offline/Online' }
                ].map(s => (
                  <div key={s.step} className={`p-2.5 rounded-xl border flex flex-col justify-center items-center transition-all ${
                    currentStep >= s.step 
                      ? 'bg-primary/10 border-primary/20 text-primary' 
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400'
                  }`}>
                    <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black mb-1 ${
                      currentStep >= s.step ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                    }`}>
                      {currentStep > s.step ? <Check size={10} strokeWidth={3} /> : s.step}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider font-premium leading-none">{s.label}</span>
                    <span className="text-[8px] opacity-70 mt-0.5">{s.desc}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleProcessDocument}
                  disabled={processStatus === 'running'}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white rounded-2xl text-xs font-black uppercase tracking-wider font-premium shadow-primary active:scale-[0.99] transition-all"
                >
                  {processStatus === 'running' ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Procesando Transmisión SRI...
                    </>
                  ) : (
                    <>
                      <Play size={14} fill="currentColor" />
                      Procesar, Firmar y Autorizar en SRI
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* Right panel - Logs & Code output */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live Terminal Log */}
            <div className="glass-card-premium overflow-hidden flex flex-col h-[280px] bg-slate-950 border-white/5 relative">
              <div className="px-4 py-2 border-b border-white/5 bg-slate-900 flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-400">
                  <Activity size={12} className="text-primary animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest font-premium">Consola de Transmisión SRI</span>
                </div>
                <button 
                  onClick={() => setConsoleLogs([])}
                  className="text-[9px] font-semibold text-slate-500 hover:text-slate-300 transition-colors uppercase"
                >
                  Limpiar
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto font-mono text-[10px] space-y-1.5 no-scrollbar select-text text-slate-300">
                {consoleLogs.length === 0 ? (
                  <div className="text-slate-600 italic">Esperando inicio de proceso de transmisión...</div>
                ) : (
                  consoleLogs.map((log, index) => (
                    <div key={index} className="leading-relaxed border-l border-white/5 pl-2">
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* XML Output viewer */}
            <div className="glass-card-premium overflow-hidden flex flex-col min-h-[300px]">
              <div className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documento XML Resultante</span>
                <div className="flex gap-2">
                  {generatedXml && (
                    <>
                      <button
                        onClick={() => copyToClipboard(generatedXml, 'XML')}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                        title="Copiar XML"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => {
                          const mockHistoric: HistoricComprobante = {
                            id: '',
                            tipo: docType,
                            secuencial: 'TMP',
                            claveAcceso: generatedAccessKey,
                            rucReceptor: buyerRuc,
                            nombreReceptor: buyerName,
                            fechaEmision: '',
                            total: 0,
                            estado: 'Generado',
                            xml: generatedXml,
                            ambiente
                          };
                          downloadXmlFile(mockHistoric);
                        }}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                        title="Descargar XML"
                      >
                        <Download size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 p-4 bg-slate-950 font-mono text-[10px] overflow-auto max-h-[350px] no-scrollbar text-emerald-400 select-text">
                {generatedXml ? (
                  <pre className="whitespace-pre">{generatedXml}</pre>
                ) : (
                  <div className="text-slate-600 italic flex flex-col justify-center items-center h-full pt-16">
                    <Database size={24} className="mb-2 opacity-35" />
                    El código XML se mostrará aquí una vez generado.
                  </div>
                )}
              </div>
            </div>

            {/* JSON payload helper */}
            <div className="glass-card-premium overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">JSON Payload Enviado</span>
              </div>
              <div className="p-4 bg-slate-950 font-mono text-[10px] overflow-auto max-h-[180px] no-scrollbar text-sky-400 select-text">
                {generatedJson ? (
                  <pre className="whitespace-pre">{generatedJson}</pre>
                ) : (
                  <div className="text-slate-600 italic text-center py-6">Estructura del payload JSON.</div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: HISTORIAL DE COMPROBANTES */}
      {activeTab === 'historial' && (
        <div className="glass-card-premium p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Archivo de Comprobantes Transmitidos</h3>
            
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative group w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={14} />
                <input
                  type="text"
                  placeholder="Buscar RUC, nombre o clave..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary transition-all font-semibold uppercase tracking-wider"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-semibold"
              >
                <option value="all">TODOS LOS ESTADOS</option>
                <option value="Autorizado">AUTORIZADO</option>
                <option value="Generado">GENERADO</option>
                <option value="Error">ERROR / FALLIDO</option>
              </select>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-slate-400">
              <FileText size={32} className="mx-auto mb-3 opacity-30 text-primary" />
              <p className="text-xs font-black uppercase tracking-wider font-premium">No se encontraron comprobantes</p>
              <p className="text-[10px] opacity-75 mt-1">Intente emitir un nuevo comprobante en la primera pestaña.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Secuencial</th>
                    <th className="py-3 px-4">Cliente / Receptor</th>
                    <th className="py-3 px-4">Fecha Emisión</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4 text-center">Ambiente</th>
                    <th className="py-3 px-4 text-center">Estado SRI</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-xs">
                  {filteredHistory.map(row => (
                    <tr key={row.id} className="hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-black uppercase tracking-wider font-premium">
                        {row.tipo === 'factura' ? (
                          <span className="text-sky-500">Factura</span>
                        ) : (
                          <span className="text-amber-500">Retención</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-600 dark:text-slate-300">
                        {row.secuencial}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide truncate max-w-[200px]">
                            {row.nombreReceptor}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 mt-0.5">RUC: {row.rucReceptor}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-500">
                        {row.fechaEmision}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-right text-slate-800 dark:text-white">
                        ${row.total.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">
                        {row.ambiente === '1' ? (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md text-[8px] font-black">Pruebas</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md text-[8px] font-black">Prod</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                          row.estado === 'Autorizado'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : row.estado === 'Error' || row.estado === 'Rechazado'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}>
                          {row.estado}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => downloadXmlFile(row)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                            title="Descargar XML"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            onClick={() => copyToClipboard(row.claveAcceso, 'Clave de Acceso')}
                            className="p-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                            title="Copiar Clave de Acceso"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            onClick={() => {
                              const remain = history.filter(item => item.id !== row.id);
                              setHistory(remain);
                              localStorage.setItem('sc_sri_comprobantes_history', JSON.stringify(remain));
                            }}
                            className="p-1 bg-slate-100 hover:bg-rose-100 dark:bg-white/5 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                            title="Eliminar registro"
                          >
                            <Trash2 size={12} />
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
      )}

      {/* TAB 3: VALIDADOR DE RUC/CEDULA */}
      {activeTab === 'validador' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6">
            
            <div className="glass-card-premium p-6 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Verificador Algorítmico SRI</h3>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={13}
                  value={validationInput}
                  onChange={(e) => setValidationInput(e.target.value)}
                  placeholder="Ingrese RUC (13 dígitos) o Cédula (10 dígitos)"
                  className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-mono font-semibold"
                />
                <button
                  type="button"
                  onClick={handleValidateId}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black uppercase tracking-wider font-premium transition-all"
                >
                  Validar
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Esta herramienta ejecuta el algoritmo matemático oficial de dígito verificador del SRI Ecuador (Módulo 10 para cédulas/personas naturales y Módulo 11 para sociedades y entidades públicas).
              </p>
            </div>
            
          </div>

          <div className="lg:col-span-6">
            <div className="glass-card-premium p-6 space-y-4 h-full">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Resultado de la Validación</h3>

              {!validationResult ? (
                <div className="flex flex-col justify-center items-center h-48 text-slate-400 italic">
                  <CheckCircle2 size={24} className="mb-2 opacity-35" />
                  Ingrese una identificación y presione Validar.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {validationResult.valid ? (
                      <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-full">
                        <CheckCircle2 size={24} />
                      </div>
                    ) : (
                      <div className="p-2 bg-rose-500/10 text-rose-600 rounded-full">
                        <XCircle size={24} />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                        {validationResult.type}
                      </div>
                      <div className={`text-[10px] font-black uppercase tracking-wider ${
                        validationResult.valid ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {validationResult.valid ? 'Estructura Correcta' : 'Inválido / Error de Dígito'}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-200 dark:bg-white/10"></div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Logs de Validación:</span>
                    <div className="bg-slate-950 p-4 rounded-xl font-mono text-[10px] text-slate-300 space-y-1.5 max-h-[200px] overflow-y-auto no-scrollbar">
                      {validationResult.details.map((detail, idx) => (
                        <div key={idx} className="border-l border-white/5 pl-2">{detail}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONFIGURACION DE CONEXION */}
      {activeTab === 'conexion' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Emisor Defaults card */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-card-premium p-6 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Configuración del Emisor (Compañía)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Razón Social</label>
                  <input
                    type="text"
                    value={emisorRazonSocial}
                    onChange={(e) => setEmisorRazonSocial(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    value={emisorNombreComercial}
                    onChange={(e) => setEmisorNombreComercial(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">RUC Emisor</label>
                  <input
                    type="text"
                    value={emisorRuc}
                    onChange={(e) => setEmisorRuc(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono font-semibold outline-none focus:border-primary"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Dirección Matriz</label>
                  <input
                    type="text"
                    value={emisorDirMatriz}
                    onChange={(e) => setEmisorDirMatriz(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Cód. Establecimiento</label>
                  <input
                    type="text"
                    value={emisorEstab}
                    onChange={(e) => setEmisorEstab(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Cód. Punto Emisión</label>
                  <input
                    type="text"
                    value={emisorPtoEmi}
                    onChange={(e) => setEmisorPtoEmi(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Régimen SRI</label>
                  <select
                    value={emisorRegimen}
                    onChange={(e) => setEmisorRegimen(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none"
                  >
                    <option value="0">REGIMEN GENERAL</option>
                    <option value="1">RIMPE NEGOCIO POPULAR</option>
                    <option value="2">RIMPE EMPRENDEDOR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Ambiente de Trabajo</label>
                  <select
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value as any)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none"
                  >
                    <option value="1">1 - PRUEBAS</option>
                    <option value="2">2 - PRODUCCIÓN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Clave de Firma Electrónica (.p12)</label>
                  <input
                    type="password"
                    value={p12Password}
                    onChange={(e) => setP12Password(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Connection settings card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-card-premium p-6 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Servidor Laravel API</h3>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Base URL de la API</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => {
                    setApiUrl(e.target.value);
                    localStorage.setItem('sc_facturacion_api_url', e.target.value);
                  }}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary font-mono"
                  placeholder="http://localhost:8000"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Prefijo de la API</label>
                <input
                  type="text"
                  value={apiPrefix}
                  onChange={(e) => setApiPrefix(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary font-mono"
                  placeholder="/api/v1"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => checkBackendConnection(apiUrl)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider font-premium transition-all"
                >
                  <RefreshCw size={12} />
                  Verificar Conexión
                </button>
              </div>

              <div className="h-px bg-slate-200 dark:bg-white/10 my-1"></div>

              {/* Laravel launch guide */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Info size={12} className="text-primary" />
                  Instrucciones de Despliegue API:
                </span>
                
                <div className="text-[10px] text-slate-500 space-y-2 leading-relaxed font-semibold">
                  <p>Si la API aparece como descodificada u offline, levante el backend de Laravel adquirido ejecutando lo siguiente en su consola local:</p>
                  
                  <div className="bg-slate-950 p-3 rounded-lg text-slate-300 font-mono text-[9px] space-y-1 select-text border border-white/5">
                    <div>cd "Sistema de Facturacion\Lib_Firmador_Xml_Facturacion _SRI"</div>
                    <div className="text-emerald-500">composer install</div>
                    <div className="text-emerald-500">php artisan serve</div>
                  </div>
                  
                  <p>Por defecto, el comando anterior habilitará la API en el puerto <code className="font-mono text-primary bg-primary/10 px-1 py-0.5 rounded">http://localhost:8000</code> y habilitará las rutas de firma y envío de comprobantes.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
