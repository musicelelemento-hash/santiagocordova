import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, Plus, Trash2, Settings, CheckCircle2, XCircle, Info, Search, 
  Download, RefreshCw, Check, AlertTriangle, Globe, Activity, Wifi, WifiOff, 
  Copy, ExternalLink, Eye, EyeOff, ChevronRight, Play, Database, CreditCard, User, AlertCircle,
  Lock, Key, Edit3, Save, Home, ChevronDown, ChevronUp, Sliders, Building2, Mail
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Client, TaxRegime, DeclarationStatus } from '../types';
import { getActivePeriodsForClient, getObligationsForPeriod } from '../services/complianceEngine';
import { getClientServiceFee } from '../services/clientService';
import { formatPeriodForDisplay } from '../services/sri';
import { db } from '../services/db';
import { SupabaseService } from '../services/supabaseClientService';

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
  mensajeError?: string;
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
  const { clients, serviceFees, updateClient } = useAppStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'factura' | 'retencion' | 'nota_credito' | 'nota_debito' | 'guia' | 'liquidacion' | 'historial' | 'validador' | 'configuracion'>('dashboard');
  const [isFacturacionOpen, setIsFacturacionOpen] = useState(true);
  const [isHerramientasOpen, setIsHerramientasOpen] = useState(true);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);

  // Sync initial client selection to auto-open Factura tab
  useEffect(() => {
    if (initialClientId) {
      setActiveTab('factura');
      selectClientAndInitialize(initialClientId);
    }
  }, [initialClientId]);


  // API connection settings — uses VITE_FACTURACION_API_URL for production (set in Netlify/Vercel env vars)
  const DEFAULT_API_URL = import.meta.env.VITE_FACTURACION_API_URL || 'https://facturador-sri-api.onrender.com';
  const [apiUrl, setApiUrl] = useState(() => {
    const stored = localStorage.getItem('sc_facturacion_api_url');
    return stored || DEFAULT_API_URL;
  });
  const [apiPrefix, setApiPrefix] = useState('/api/v1');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  
  // Emisor Defaults (Ecuador Company Details)
  const [emisorRuc, setEmisorRuc] = useState(() => localStorage.getItem('sc_emisor_ruc') || '0705787745001');
  const [emisorRazonSocial, setEmisorRazonSocial] = useState(() => localStorage.getItem('sc_emisor_razon') || 'CORDOVA RAMIREZ ROBERTO SANTIGO');
  const [emisorNombreComercial, setEmisorNombreComercial] = useState(() => localStorage.getItem('sc_emisor_comercial') || 'SOLUCIONES CONTABLES PRO');
  const [emisorDirMatriz, setEmisorDirMatriz] = useState(() => localStorage.getItem('sc_emisor_dir') || 'Colon y Sucre / Pasaje - El Oro');
  const [emisorEstab, setEmisorEstab] = useState(() => localStorage.getItem('sc_emisor_estab') || '001');
  const [emisorPtoEmi, setEmisorPtoEmi] = useState(() => localStorage.getItem('sc_emisor_pto') || '001');
  const [emisorRegimen, setEmisorRegimen] = useState(() => {
    const stored = localStorage.getItem('sc_emisor_regimen');
    if (!stored || stored === '0' || stored === '1') {
      localStorage.setItem('sc_emisor_regimen', '3');
      return '3';
    }
    return stored;
  }); // 0 = General, 3 = RIMPE Negocio Popular, 2 = RIMPE Emprendedor
  const [ambiente, setAmbienteState] = useState<'1' | '2'>(() => (localStorage.getItem('sc_emisor_ambiente') as '1' | '2') || '2'); // Default a 2 (Producción) si el usuario ya está facturando

  const setAmbiente = (newAmbiente: '1' | '2') => {
    setAmbienteState(newAmbiente);
    localStorage.setItem('sc_emisor_ambiente', newAmbiente);
  };

  const [p12FileBase64, setP12FileBase64] = useState('');
  const [p12FileName, setP12FileName] = useState('');
  const [p12Password, setP12Password] = useState('ClaveFirma123');
  const [p12ExpiryDate, setP12ExpiryDate] = useState('');
  const [p12SubjectName, setP12SubjectName] = useState('');

  // Carga asíncrona de firma electrónica desde IndexedDB con respaldo en localStorage
  useEffect(() => {
    const loadSignatureFromIndexedDB = async () => {
      try {
        const base64 = (await db.getLocal('sc_sri_p12_base64')) || localStorage.getItem('sc_sri_p12_base64') || '';
        const name = (await db.getLocal('sc_sri_p12_filename')) || localStorage.getItem('sc_sri_p12_filename') || '';
        const password = (await db.getLocal('sc_sri_p12_password')) || localStorage.getItem('sc_sri_p12_password') || 'ClaveFirma123';
        const expiry = (await db.getLocal('sc_sri_p12_expiry')) || localStorage.getItem('sc_sri_p12_expiry') || '';
        const subject = (await db.getLocal('sc_sri_p12_subject')) || localStorage.getItem('sc_sri_p12_subject') || '';
        
        setP12FileBase64(base64);
        setP12FileName(name);
        setP12Password(password);
        setP12ExpiryDate(expiry);
        setP12SubjectName(subject);
        
        if (base64) {
          setIsEditingSignature(false);
        }
      } catch (err) {
        console.error('Error loading signature from local db:', err);
      }
    };
    loadSignatureFromIndexedDB();
  }, []);

  const handlePasswordChange = async (val: string) => {
    setP12Password(val);
    await db.setLocal('sc_sri_p12_password', val);
    localStorage.setItem('sc_sri_p12_password', val);
  };

  const handleP12Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        const base64Data = result.split(',')[1] || result;
        setP12FileBase64(base64Data);
        setP12FileName(file.name);
        await db.setLocal('sc_sri_p12_base64', base64Data);
        await db.setLocal('sc_sri_p12_filename', file.name);
        await db.setLocal('sc_sri_p12_password', p12Password);
        localStorage.setItem('sc_sri_p12_base64', base64Data);
        localStorage.setItem('sc_sri_p12_filename', file.name);
        localStorage.setItem('sc_sri_p12_password', p12Password);

        // Try to extract expiry/subject from the binary DER data embedded in the .p12
        try {
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

          const found: Date[] = [];
          for (let i = 0; i < bytes.length - 15; i++) {
            if ((bytes[i] === 0x17 || bytes[i] === 0x18) && bytes[i+1] >= 12) {
              const len = bytes[i+1];
              const str = Array.from(bytes.slice(i+2, i+2+len)).map(b => String.fromCharCode(b)).join('');
              let d: Date | null = null;
              if (bytes[i] === 0x17 && str.length === 13) {
                const yr = parseInt(str.substring(0, 2));
                const year = yr >= 50 ? 1900 + yr : 2000 + yr;
                d = new Date(`${year}-${str.substring(2,4)}-${str.substring(4,6)}T${str.substring(6,8)}:${str.substring(8,10)}:${str.substring(10,12)}Z`);
              } else if (bytes[i] === 0x18 && str.length === 15) {
                d = new Date(`${str.substring(0,4)}-${str.substring(4,6)}-${str.substring(6,8)}T${str.substring(8,10)}:${str.substring(10,12)}:${str.substring(12,14)}Z`);
              }
              if (d && !isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2060) {
                found.push(d);
              }
            }
          }

          if (found.length >= 2) {
            found.sort((a, b) => a.getTime() - b.getTime());
            const expiry = found[found.length - 1];
            const formatted = expiry.toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: '2-digit' });
            setP12ExpiryDate(formatted);
            await db.setLocal('sc_sri_p12_expiry', formatted);
            localStorage.setItem('sc_sri_p12_expiry', formatted);

            const daysLeft = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const subjectNote = daysLeft < 0 ? '⚠️ CERTIFICADO VENCIDO' : daysLeft < 60 ? `⚠️ Vence en ${daysLeft} días` : `✓ Válido (${daysLeft} días restantes)`;
            setP12SubjectName(subjectNote);
            await db.setLocal('sc_sri_p12_subject', subjectNote);
            localStorage.setItem('sc_sri_p12_subject', subjectNote);
          } else {
            setP12ExpiryDate('No detectada');
            setP12SubjectName('Archivo cargado correctamente');
            await db.setLocal('sc_sri_p12_expiry', 'No detectada');
            localStorage.setItem('sc_sri_p12_expiry', 'No detectada');
            await db.setLocal('sc_sri_p12_subject', 'Archivo cargado correctamente');
          }
        } catch {
          setP12ExpiryDate('No detectada');
          await db.setLocal('sc_sri_p12_expiry', 'No detectada');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Emission fields
  const [docType, setDocType] = useState<'factura' | 'retencion'>('factura');

  // Synchronize docType state when activeTab changes to factura or retencion
  useEffect(() => {
    if (activeTab === 'factura') {
      setDocType('factura');
    } else if (activeTab === 'retencion') {
      setDocType('retencion');
    }
  }, [activeTab]);

  const [selectedClient, setSelectedClient] = useState<string>('');
  
  // Buyer / Subject Details
  const [buyerName, setBuyerName] = useState('');
  const [buyerRuc, setBuyerRuc] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerIdType, setBuyerIdType] = useState('05'); // 04 = RUC, 05 = Cédula, 06 = Pasaporte

  // Invoice specifics
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>(() => {
    const stored = localStorage.getItem('sc_emisor_regimen');
    const initialRegime = (!stored || stored === '0' || stored === '1') ? '3' : stored;
    const initialIva = initialRegime === '3' ? 0.00 : 0.15;
    const initialSub = 120.00;
    const initialIvaVal = Number((initialSub * initialIva).toFixed(2));
    return [
      {
        id: '1',
        codigoPrincipal: '001',
        descripcion: 'Asesoría Tributaria Mensual Profesional',
        cantidad: 1,
        precioUnitario: 120.00,
        ivaRate: initialIva,
        subtotal: initialSub,
        iva: initialIvaVal,
        total: Number((initialSub + initialIvaVal).toFixed(2))
      }
    ];
  });
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
  const [processErrorMessage, setProcessErrorMessage] = useState<string | null>(null);
  
  // Historical logs
  const [history, setHistory] = useState<HistoricComprobante[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [clientSearchQuery, setClientSearchQuery] = useState('');
  
  const getMaxSecuencialInHistory = (type: 'factura' | 'retencion') => {
    const filtered = history.filter(h => h.tipo === type && h.secuencial);
    if (filtered.length === 0) return 0;
    const numbers = filtered.map(h => parseInt(h.secuencial, 10)).filter(n => !isNaN(n));
    return numbers.length > 0 ? Math.max(...numbers) : 0;
  };
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [billingMode, setBillingMode] = useState<'detallado' | 'consolidado'>('detallado');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [isEditingSignature, setIsEditingSignature] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showP12Password, setShowP12Password] = useState(false);
  const [emisorLogo, setEmisorLogo] = useState(() => localStorage.getItem('sc_emisor_logo') || '');
  const [emisorSecuencialInicio, setEmisorSecuencialInicio] = useState(() => Number(localStorage.getItem('sc_emisor_secuencial_inicio')) || 1);
  const [selectedComprobanteForRide, setSelectedComprobanteForRide] = useState<HistoricComprobante | null>(null);

  const activeClientObj = useMemo(() => {
    return clients.find(c => c.id === selectedClient) || null;
  }, [selectedClient, clients]);

  // Compute pending obligations/balances list
  const pendingObligations = useMemo(() => {
    if (!activeClientObj) return [];
    
    const list: Array<{ id: string; period: string; type: 'IVA' | 'RENTA' | 'ICE' | 'ANEXO'; label: string; amount: number; isDeclared: boolean; isPaid: boolean }> = [];
    const declarations = activeClientObj.declarations || [];
    
    const activePeriods = getActivePeriodsForClient(activeClientObj, new Date());
    
    activePeriods.forEach(p => {
      const obligations = getObligationsForPeriod(activeClientObj, p);
      obligations.forEach(ob => {
        const decl = declarations.find(d => d.period === p && (d.type === ob.type || (!d.type && (ob.type === 'IVA' || ob.type === 'RENTA'))));
        const declared = !!decl && (decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pagada || !!decl.proof_file);
        const paid = !!decl && (decl.status === DeclarationStatus.Pagada || !!decl.is_paid);
        
        // If not declared or not paid, it has an outstanding balance
        if (!declared || !paid) {
          const amount = decl?.amount || getClientServiceFee(activeClientObj, serviceFees, p);
          list.push({
            id: `${p}:${ob.type}`,
            period: p,
            type: ob.type as any,
            label: ob.label,
            amount,
            isDeclared: declared,
            isPaid: paid
          });
        }
      });
    });
    
    return list;
  }, [activeClientObj, serviceFees]);

  const filteredClientsForSearch = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients.filter(c => !c.isDeleted);
    const query = clientSearchQuery.toLowerCase();
    return clients.filter(c => !c.isDeleted && (
      c.name.toLowerCase().includes(query) ||
      c.ruc.includes(query) ||
      (c.tradeName && c.tradeName.toLowerCase().includes(query))
    ));
  }, [clients, clientSearchQuery]);

  const selectClientAndInitialize = (clientId: string) => {
    setSelectedClient(clientId);
    setIsClientDropdownOpen(false);
    setSelectedPeriods([]); // Reset selected periods when client changes
    
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setClientSearchQuery(`${client.name} (${client.ruc})`);
    } else {
      setClientSearchQuery('');
    }
  };

  // Sync initial client selection when selectedClient starts empty but gets filled by redirect/initial parameters
  useEffect(() => {
    if (selectedClient && !clientSearchQuery) {
      const client = clients.find(c => c.id === selectedClient);
      if (client) {
        setClientSearchQuery(`${client.name} (${client.ruc})`);
      }
    }
  }, [selectedClient, clients]);

  // Synchronize selected periods to invoice items
  useEffect(() => {
    if (selectedPeriods.length === 0) return;
    if (!activeClientObj) return;
 
    const checkedObs = pendingObligations.filter(ob => selectedPeriods.includes(ob.id));
    if (checkedObs.length === 0) return;
 
    const currentIvaRate = emisorRegimen === '3' ? 0.00 : 0.15;
 
    if (billingMode === 'detallado') {
      const newItems: InvoiceItem[] = checkedObs.map((ob, idx) => {
        const desc = `Declaración de ${ob.label} - Período ${formatPeriodForDisplay(ob.period)}`;
        const sub = ob.amount;
        const tax = Number((sub * currentIvaRate).toFixed(2));
        return {
          id: `period-${ob.id}`,
          codigoPrincipal: ob.type === 'IVA' ? '002' : ob.type === 'RENTA' ? '003' : '001',
          descripcion: desc,
          cantidad: 1,
          precioUnitario: ob.amount,
          ivaRate: currentIvaRate,
          subtotal: sub,
          iva: tax,
          total: Number((sub + tax).toFixed(2))
        };
      });
      setInvoiceItems(newItems);
    } else {
      // Consolidado
      const totalAmount = checkedObs.reduce((sum, ob) => sum + ob.amount, 0);
      const periodsStr = checkedObs.map(ob => `${ob.type} ${formatPeriodForDisplay(ob.period).replace('IVA ', '')}`).join(', ');
      const desc = `Servicios Contables Profesionales - Períodos: ${periodsStr}`;
      const tax = Number((totalAmount * currentIvaRate).toFixed(2));
      setInvoiceItems([
        {
          id: 'consolidated-1',
          codigoPrincipal: '001',
          descripcion: desc,
          cantidad: 1,
          precioUnitario: totalAmount,
          ivaRate: currentIvaRate,
          subtotal: totalAmount,
          iva: tax,
          total: Number((totalAmount + tax).toFixed(2))
        }
      ]);
    }
  }, [selectedPeriods, billingMode, activeClientObj, pendingObligations, emisorRegimen]);

  // ID Validator utility
  const [validationInput, setValidationInput] = useState('');
  const [validationResult, setValidationResult] = useState<{
    tested: boolean;
    valid: boolean;
    type: string;
    details: string[];
  } | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Check connection status to Laravel backend usando el endpoint público /ping
  const checkBackendConnection = async (urlToCheck = apiUrl) => {
    setConnectionStatus('checking');
    try {
      const response = await fetch(`${urlToCheck}${apiPrefix}/ping`, { 
        method: 'GET', 
        mode: 'cors',
        headers: {
          'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir'
        }
      });
      if (response.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (e) {
      setConnectionStatus('disconnected');
    }
  };

  const fetchSignatureVigencia = async () => {
    const storedBase64 = await db.getLocal('sc_sri_p12_base64') || p12FileBase64;
    const storedPassword = await db.getLocal('sc_sri_p12_password') || p12Password;
    if (!storedBase64) return;
    
    try {
      const response = await fetch(`${apiUrl}${apiPrefix}/facturacion/firma/vigencia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir'
        },
        body: JSON.stringify({
          certificado_p12_base64: storedBase64,
          clave: storedPassword
        })
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.status && resData.data) {
          const certInfo = resData.data;
          const exp = certInfo.valido_hasta || certInfo.validTo_time_t || certInfo.validTo || '';
          
          let formattedExpiry = '';
          if (exp) {
            const expDate = new Date(typeof exp === 'number' ? exp * 1000 : exp);
            if (!isNaN(expDate.getTime())) {
              formattedExpiry = expDate.toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: '2-digit' });
              setP12ExpiryDate(formattedExpiry);
              await db.setLocal('sc_sri_p12_expiry', formattedExpiry);
              
              const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const subjectNote = daysLeft < 0 ? '⚠️ CERTIFICADO VENCIDO' : daysLeft < 60 ? `⚠️ Vence en ${daysLeft} días` : `✓ Válido (${daysLeft} días restantes)`;
              setP12SubjectName(subjectNote);
              await db.setLocal('sc_sri_p12_subject', subjectNote);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching signature details from backend:', err);
    }
  };

  useEffect(() => {
    const runChecks = async () => {
      await checkBackendConnection();
      await fetchSignatureVigencia();
    };
    runChecks();
  }, []);

  // Warm-up: despierta el backend de Render (free tier se duerme tras 15 min)
  // Se dispara cuando el usuario entra a la pestaña de Factura o Retención,
  // antes de que presione cualquier botón — así ya está despierto cuando lo necesita.
  useEffect(() => {
    if (activeTab === 'factura' || activeTab === 'retencion') {
      fetch(`${apiUrl}${apiPrefix}/ping`, { 
        method: 'GET', 
        mode: 'cors',
        headers: {
          'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir'
        }
      })
      .catch(() => {}); // silencioso — solo para despertar el servidor
    }
  }, [activeTab]);

  const saveRecordToHistory = async (newRecord: HistoricComprobante) => {
    setHistory(prev => {
      const updated = [newRecord, ...prev];
      db.setLocal('sc_sri_comprobantes_history', updated).catch(e => console.error(e));
      return updated;
    });

    try {
      await SupabaseService.upsertSriComprobante(newRecord);
    } catch (err) {
      console.error('Error saving invoice to Supabase:', err);
    }
  };

  // Load history from Supabase (with IndexedDB fallback)
  useEffect(() => {
    const loadComprobantesHistory = async () => {
      try {
        const dbComprobantes = await SupabaseService.getSriComprobantes();
        if (dbComprobantes && dbComprobantes.length > 0) {
          setHistory(dbComprobantes);
          await db.setLocal('sc_sri_comprobantes_history', dbComprobantes);
          return;
        }
      } catch (err) {
        console.error('Error loading history from Supabase:', err);
      }

      try {
        const stored = await db.getLocal('sc_sri_comprobantes_history');
        if (stored) {
          setHistory(stored);
        } else {
          const legacy = localStorage.getItem('sc_sri_comprobantes_history');
          if (legacy) {
            const parsed = JSON.parse(legacy);
            setHistory(parsed);
            await db.setLocal('sc_sri_comprobantes_history', parsed);
          }
        }
      } catch (e) {
        console.error('Error loading history from local backup:', e);
      }
    };
    loadComprobantesHistory();
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
      setActiveTab('factura');
      
      if (initialAmount) {
        const mapped = mapDescriptionToProduct(initialDescription || 'Honorarios por Servicios Contables');
        const currentIvaRate = emisorRegimen === '3' ? 0.00 : 0.15;
        const tax = Number((initialAmount * currentIvaRate).toFixed(2));
        setInvoiceItems([
          {
            id: 'init-1',
            codigoPrincipal: mapped.code,
            descripcion: mapped.description,
            cantidad: 1,
            precioUnitario: initialAmount,
            ivaRate: currentIvaRate,
            subtotal: initialAmount,
            iva: tax,
            total: Number((initialAmount + tax).toFixed(2))
          }
        ]);
      }
      
      if (onClearInitialData) {
        onClearInitialData();
      }
    }
  }, [initialClientId, initialAmount, initialDescription, onClearInitialData, emisorRegimen]);

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

  // Synchronize invoice items with emisorRegimen (Force 0% IVA for RIMPE Negocio Popular)
  useEffect(() => {
    if (emisorRegimen === '3') {
      setInvoiceItems(prev => prev.map(item => {
        if (item.ivaRate !== 0.00) {
          const sub = item.cantidad * item.precioUnitario;
          return {
            ...item,
            ivaRate: 0.00,
            subtotal: Number(sub.toFixed(2)),
            iva: 0.00,
            total: Number(sub.toFixed(2))
          };
        }
        return item;
      }));
    }
  }, [emisorRegimen]);

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

  const handleResetForm = () => {
    setSelectedClient('');
    setClientSearchQuery('');
    setBuyerName('');
    setBuyerRuc('');
    setBuyerEmail('');
    setBuyerPhone('');
    setBuyerAddress('');
    setBuyerIdType('05');
    const initialIva = emisorRegimen === '3' ? 0.00 : 0.15;
    const initialSub = 120.00;
    const initialIvaVal = Number((initialSub * initialIva).toFixed(2));
    setInvoiceItems([
      {
        id: '1',
        codigoPrincipal: '001',
        descripcion: 'Asesoría Tributaria Mensual Profesional',
        cantidad: 1,
        precioUnitario: 120.00,
        ivaRate: initialIva,
        subtotal: initialSub,
        iva: initialIvaVal,
        total: Number((initialSub + initialIvaVal).toFixed(2))
      }
    ]);
    setSelectedPeriods([]);
    setGeneratedXml('');
    setGeneratedJson('');
    setGeneratedAccessKey('');
    setProcessStatus('idle');
    setCurrentStep(0);
    setConsoleLogs([]);
  };

  const handleLoadMockData = () => {
    setBuyerName('CORDOVA ORTEGA ROBERTO ESTEBAN');
    setBuyerRuc('0705787745');
    setBuyerEmail('roberto.esteban@correo.com');
    setBuyerPhone('0987654321');
    setBuyerAddress('Centro de Pasaje, El Oro, Ecuador');
    setBuyerIdType('05');
    const initialIva = emisorRegimen === '3' ? 0.00 : 0.15;
    const sub1 = 350.00;
    const tax1 = Number((sub1 * initialIva).toFixed(2));
    const sub2 = 160.00;
    const tax2 = Number((sub2 * initialIva).toFixed(2));
    setInvoiceItems([
      {
        id: 'mock-1',
        codigoPrincipal: '004',
        descripcion: 'Honorarios por Auditoría Externa y Estados Financieros',
        cantidad: 1,
        precioUnitario: 350.00,
        ivaRate: initialIva,
        subtotal: sub1,
        iva: tax1,
        total: Number((sub1 + tax1).toFixed(2))
      },
      {
        id: 'mock-2',
        codigoPrincipal: '001',
        descripcion: 'Servicios de Consultoría y Planificación Tributaria Anual',
        cantidad: 2,
        precioUnitario: 80.00,
        ivaRate: initialIva,
        subtotal: sub2,
        iva: tax2,
        total: Number((sub2 + tax2).toFixed(2))
      }
    ]);
    setSelectedPeriods([]);
    setGeneratedXml('');
    setGeneratedJson('');
    setGeneratedAccessKey('');
    setProcessStatus('idle');
    setCurrentStep(0);
    setConsoleLogs([]);
  };

  // Invoice helper functions
  const addInvoiceItem = () => {
    const nextNum = invoiceItems.length + 1;
    const nextCode = String(nextNum).padStart(3, '0');
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      codigoPrincipal: nextCode,
      descripcion: '',
      cantidad: 1,
      precioUnitario: 0.00,
      ivaRate: emisorRegimen === '3' ? 0.00 : 0.15,
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
    const cleanFecha = fecha.replace(/-/g, ''); // "20260716" → YYYYMMDD
    const d = cleanFecha.substring(6, 8) + cleanFecha.substring(4, 6) + cleanFecha.substring(0, 4); // DD+MM+YYYY = "16072026"
    
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
    const nextNum = Math.max(emisorSecuencialInicio, getMaxSecuencialInHistory(docType) + 1);
    
    const onSuccessBilling = async (secNum: number) => {
      // 1. Increment sequential number
      const nextSecNum = secNum + 1;
      setEmisorSecuencialInicio(nextSecNum);
      localStorage.setItem('sc_emisor_secuencial_inicio', String(nextSecNum));

      // 2. Mark declarations as paid / reconcile debt
      if (selectedClient && selectedPeriods.length > 0) {
        const client = clients.find(c => c.id === selectedClient);
        if (client) {
          const updatedDeclarations = (client.declarations || []).map(d => {
            const isSelected = selectedPeriods.some(spId => {
              const [spPeriod, spType] = spId.split(':');
              return d.period === spPeriod && (d.type === spType || (!d.type && spType === 'IVA'));
            });
            if (isSelected) {
              return {
                ...d,
                status: 'Pagada' as any,
                is_paid: true,
                paidAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
            }
            return d;
          });

          selectedPeriods.forEach(spId => {
            const [spPeriod, spType] = spId.split(':');
            const exists = (client.declarations || []).some(d => d.period === spPeriod && (d.type === spType || (!d.type && spType === 'IVA')));
            if (!exists) {
              updatedDeclarations.push({
                period: spPeriod,
                type: spType as any,
                status: 'Pagada' as any,
                is_paid: true,
                paidAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                amount: pendingObligations.find(o => o.id === spId)?.amount || 0
              });
            }
          });

          try {
            await updateClient(selectedClient, { declarations: updatedDeclarations });
            addLog(`Se actualizaron las obligaciones del cliente en la base de datos (${selectedPeriods.length} períodos marcados como pagados).`, 'success');
          } catch (err) {
            console.error("Failed to update client declarations:", err);
          }
        }
      }
    };

    setProcessStatus('running');
    setConsoleLogs([]);
    setGeneratedXml('');
    setGeneratedJson('');
    setCurrentStep(1);

    const isMock = connectionStatus !== 'connected';
    
    addLog(`Iniciando proceso de emisión de ${docType === 'factura' ? 'Factura' : 'Retención'}...`);
    addLog(`Ambiente: ${ambiente === '1' ? '1 (PRUEBAS)' : '2 (PRODUCCIÓN)'}. Modo: ${isMock ? 'SIMULACIÓN DEMO' : 'API LARAVEL CONECTADA'}`);

    // Formulate payload
    const secuencial = String(nextNum).padStart(9, '0');
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
        fechaEmision: todayStr, // YYYY-MM-DD (Parsed correctly by PHP date_create)
        dirEstablecimiento: emisorDirMatriz,
        obligadoContabilidad: 'NO',
        tipoIdentificacionComprador: buyerIdType,
        razonSocialComprador: buyerName,
        identificacionComprador: buyerRuc,
        totalSinImpuestos: invoiceTotals.subtotal.toFixed(2),
        totalDescuento: '0.00',
        totalImpuesto: emisorRegimen === '3'
          ? [{ codigo: '2', codigoPorcentaje: '0', baseImponible: invoiceTotals.subtotal.toFixed(2), valor: '0.00' }]
          : [{ codigo: '2', codigoPorcentaje: '4', baseImponible: invoiceTotals.subtotal15.toFixed(2), valor: invoiceTotals.iva.toFixed(2) }],
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
        fechaEmision: todayStr, // YYYY-MM-DD
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
        fechaEmisionDocSustento: w.fechaEmisionDocSustento // YYYY-MM-DD
      }));
    }

    setGeneratedJson(JSON.stringify(payload, null, 2));

    // Wait a brief delay for realism in logs
    await new Promise(r => setTimeout(r, 800));

    let currentXml = '';
    try {
      
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
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir'
          },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Error en API al generar XML: ${response.statusText}`);
        const data = await response.json();
        // Controller returns: { status: true, data: { xml: '...', xml_base64: '...' } }
        currentXml = data.data?.xml || data.xml;
        if (!currentXml) throw new Error('La API no devolvió el XML generado. Revise los logs del servidor.');
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
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir'
          },
          body: JSON.stringify({
            tipo: docType,
            xml: currentXml,
            clave: p12Password,
            clave_certificado: p12Password,
            ...(p12FileBase64 ? { certificado_p12_base64: p12FileBase64 } : {})
          })
        });
        if (!signResponse.ok) throw new Error(`Error en API al firmar: ${signResponse.statusText}`);
        const signData = await signResponse.json();
        currentXml = signData.data?.xml || signData.xml_firmado || signData.xml;
        if (!currentXml) throw new Error('La API de firma no devolvió el XML firmado. Verifique la clave y el archivo .p12.');
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
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir'
          },
          body: JSON.stringify({
            xml: currentXml,
            ambiente
          })
        });
        if (!sendResponse.ok) throw new Error(`Fallo de conexión al SRI: ${sendResponse.statusText}`);
        const sendData = await sendResponse.json();
        addLog(`Respuesta Recepción SRI: ${JSON.stringify(sendData.data || sendData.respuesta || sendData)}`, 'success');
        
        const sendResultStr = JSON.stringify(sendData).toUpperCase();
        if (sendResultStr.includes('"ESTADO":"DEVUELTA"') || sendResultStr.includes('ESTADO:DEVUELTA')) {
          let errMsg = 'Rechazo en Recepción SRI: ';
          try {
            const sendObj = typeof sendData.data === 'string' ? JSON.parse(sendData.data) : (sendData.data || sendData);
            const comprobante = sendObj?.RespuestaRecepcionComprobante?.comprobantes?.comprobante || sendObj?.comprobantes?.comprobante;
            if (comprobante) {
              const mensaje = comprobante.mensajes?.mensaje;
              const mensajesList = Array.isArray(mensaje) ? mensaje : (mensaje ? [mensaje] : []);
              errMsg += mensajesList.map((m: any) => `${m.mensaje || 'Error'}: ${m.informacionAdicional || ''}`).join(' | ');
            } else {
              errMsg += JSON.stringify(sendObj);
            }
          } catch (e) {
            errMsg += JSON.stringify(sendData);
          }
          throw new Error(errMsg);
        }
      }

      // Step 4: Authorize
      setCurrentStep(4);
      await new Promise(r => setTimeout(r, 1500));
      addLog(`Solicitando autorización de comprobante para clave de acceso: ${key}...`);

      if (isMock) {
        addLog(`Comprobante AUTORIZADO por el SRI el ${new Date().toLocaleString()}`, 'success');
        addLog(`Número de autorización: ${key}`);
        setProcessStatus('success');
        setShowWhatsAppModal(true);

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

        await saveRecordToHistory(newRecord);
        await onSuccessBilling(nextNum);
      } else {
        const authResponse = await fetch(`${apiUrl}${apiPrefix}/facturacion/sri/autorizar`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir'
          },
          body: JSON.stringify({
            clave_acceso: key,
            ambiente
          })
        });
        if (!authResponse.ok) throw new Error(`Fallo consulta autorización: ${authResponse.statusText}`);
        const authData = await authResponse.json();
        
        addLog(`Respuesta Autorización SRI: ${JSON.stringify(authData.data || authData.respuesta || authData)}`, 'success');
        
        const rawDataStr = typeof authData.data === 'string' ? authData.data : JSON.stringify(authData.data || {});
        const uppercaseData = rawDataStr.toUpperCase().replace(/[\s\\"]/g, ''); // Remove spaces, backslashes, and quotes
        const isAuthorized = authData.status && uppercaseData.includes('ESTADO:AUTORIZADO');
        setProcessStatus(isAuthorized ? 'success' : 'failed');
        if (isAuthorized) {
          setShowWhatsAppModal(true);
          await onSuccessBilling(nextNum);
        }

        let errorMsg = '';
        if (!isAuthorized) {
          try {
            const authObj = typeof authData.data === 'string' ? JSON.parse(authData.data) : authData.data;
            const autorizacion = authObj?.RespuestaAutorizacionComprobante?.autorizaciones?.autorizacion;
            if (autorizacion) {
              const mensajesObj = autorizacion.mensajes?.mensaje;
              const mensajesList = Array.isArray(mensajesObj) ? mensajesObj : (mensajesObj ? [mensajesObj] : []);
              errorMsg = mensajesList.map((m: any) => `${m.mensaje || 'Error'}: ${m.informacionAdicional || ''}`).join(' | ');
            }
          } catch (e) {
            errorMsg = JSON.stringify(authData.data || authData);
          }
          if (!errorMsg) {
            errorMsg = 'No autorizado por el SRI (Estado no AUTORIZADO)';
          }
          setProcessErrorMessage(errorMsg);
        }

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
          ambiente,
          mensajeError: isAuthorized ? undefined : errorMsg
        };
        await saveRecordToHistory(newRecord);
      }

    } catch (err: any) {
      addLog(`Error en el flujo: ${err.message}`, 'error');
      setProcessStatus('failed');
      setProcessErrorMessage(err.message);

      const newRecord: HistoricComprobante = {
        id: Date.now().toString(),
        tipo: docType,
        secuencial,
        claveAcceso: key,
        rucReceptor: buyerRuc,
        nombreReceptor: buyerName,
        fechaEmision: todayStr,
        total: docType === 'factura' ? invoiceTotals.total : withholdingTotal,
        estado: 'Error',
        xml: currentXml,
        ambiente,
        mensajeError: err.message
      };
      await saveRecordToHistory(newRecord);
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

  const printRideDocument = (comprobante: HistoricComprobante) => {
    let emisor = {
      razonSocial: emisorRazonSocial,
      nombreComercial: emisorNombreComercial,
      ruc: emisorRuc,
      dirMatriz: emisorDirMatriz,
      estab: emisorEstab,
      ptoEmi: emisorPtoEmi,
      secuencial: comprobante.secuencial,
      claveAcceso: comprobante.claveAcceso,
      ambiente: comprobante.ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS',
      regimen: emisorRegimen
    };

    let receptor = {
      razonSocial: comprobante.nombreReceptor,
      identificacion: comprobante.rucReceptor,
      direccion: comprobante.rucReceptor === buyerRuc ? buyerAddress || 'Pasaje, El Oro' : 'Ecuador',
      fechaEmision: comprobante.fechaEmision
    };

    let itemsHtml = '';
    let subtotal15 = 0;
    let subtotal0 = comprobante.total;
    let iva15 = 0;
    let total = comprobante.total;
    let formaPagoDesc = 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO';
    let formaPagoTotal = comprobante.total;

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(comprobante.xml, "text/xml");
      
      const razonSocial = xmlDoc.getElementsByTagName("razonSocial")[0]?.textContent;
      if (razonSocial) emisor.razonSocial = razonSocial;
      const nombreComercial = xmlDoc.getElementsByTagName("nombreComercial")[0]?.textContent;
      if (nombreComercial) emisor.nombreComercial = nombreComercial;
      const ruc = xmlDoc.getElementsByTagName("ruc")[0]?.textContent;
      if (ruc) emisor.ruc = ruc;
      const dirMatriz = xmlDoc.getElementsByTagName("dirMatriz")[0]?.textContent;
      if (dirMatriz) emisor.dirMatriz = dirMatriz;
      const estab = xmlDoc.getElementsByTagName("estab")[0]?.textContent;
      if (estab) emisor.estab = estab;
      const ptoEmi = xmlDoc.getElementsByTagName("ptoEmi")[0]?.textContent;
      if (ptoEmi) emisor.ptoEmi = ptoEmi;

      const razonSocialComprador = xmlDoc.getElementsByTagName("razonSocialComprador")[0]?.textContent;
      if (razonSocialComprador) receptor.razonSocial = razonSocialComprador;
      const identificacionComprador = xmlDoc.getElementsByTagName("identificacionComprador")[0]?.textContent;
      if (identificacionComprador) receptor.identificacion = identificacionComprador;
      const direccionComprador = xmlDoc.getElementsByTagName("direccionComprador")[0]?.textContent;
      if (direccionComprador) receptor.direccion = direccionComprador;

      const detalles = xmlDoc.getElementsByTagName("detalle");
      if (detalles.length > 0) {
        for (let i = 0; i < detalles.length; i++) {
          const d = detalles[i];
          const codigo = d.getElementsByTagName("codigoPrincipal")[0]?.textContent || '001';
          const descripcion = d.getElementsByTagName("descripcion")[0]?.textContent || 'Servicios Contables';
          const cantidad = Number(d.getElementsByTagName("cantidad")[0]?.textContent || 1);
          const precioUnitario = Number(d.getElementsByTagName("precioUnitario")[0]?.textContent || comprobante.total);
          const precioTotalSinImpuesto = Number(d.getElementsByTagName("precioTotalSinImpuesto")[0]?.textContent || comprobante.total);
          
          itemsHtml += "<tr><td style='font-family: monospace;'>" + codigo + "</td><td style='text-align: center;'>" + cantidad.toFixed(2) + "</td><td style='text-transform: uppercase;'>" + descripcion + "</td><td style='text-align: right; font-family: monospace;'>$" + precioUnitario.toFixed(2) + "</td><td style='text-align: right; font-family: monospace; font-weight: bold;'>$" + precioTotalSinImpuesto.toFixed(2) + "</td></tr>";
        }
      }

      const totalImpuestos = xmlDoc.getElementsByTagName("totalImpuesto");
      if (totalImpuestos.length > 0) {
        subtotal0 = 0;
        for (let i = 0; i < totalImpuestos.length; i++) {
          const imp = totalImpuestos[i];
          const codigoPorcentaje = imp.getElementsByTagName("codigoPorcentaje")[0]?.textContent;
          const baseImponible = Number(imp.getElementsByTagName("baseImponible")[0]?.textContent || 0);
          const valor = Number(imp.getElementsByTagName("valor")[0]?.textContent || 0);
          
          if (codigoPorcentaje === '4' || codigoPorcentaje === '2') {
            subtotal15 = baseImponible;
            iva15 = valor;
          } else if (codigoPorcentaje === '0') {
            subtotal0 = baseImponible;
          }
        }
        total = Number(xmlDoc.getElementsByTagName("importeTotal")[0]?.textContent || comprobante.total);
      }

      const pago = xmlDoc.getElementsByTagName("pago")[0];
      if (pago) {
        const code = pago.getElementsByTagName("formaPago")[0]?.textContent;
        const descMap: Record<string, string> = {
          '01': 'SIN UTILIZACION DEL SISTEMA FINANCIERO (EFECTIVO)',
          '19': 'TARJETA DE CREDITO',
          '20': 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO (TRANSFERENCIA)',
          '17': 'DINERO ELECTRONICO / DIGITAL'
        };
        formaPagoDesc = descMap[code || '01'] || 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO';
        formaPagoTotal = Number(pago.getElementsByTagName("total")[0]?.textContent || total);
      }
    } catch (e) {
      console.error(e);
    }

    let authDateStr = '';
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(comprobante.xml || '', "text/xml");
      const fechaAutorizacion = xmlDoc.getElementsByTagName("fechaAutorizacion")[0]?.textContent;
      if (fechaAutorizacion) {
        if (fechaAutorizacion.includes('T')) {
          const parts = fechaAutorizacion.split('T');
          const dateParts = parts[0].split('-'); // YYYY-MM-DD
          const timeParts = parts[1].split('-')[0].split('+')[0]; // HH:MM:SS
          authDateStr = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} ${timeParts}`;
        } else {
          authDateStr = fechaAutorizacion;
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (!authDateStr) {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      authDateStr = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }

    if (!itemsHtml) {
      itemsHtml = "<tr><td style='font-family: monospace;'>001</td><td style='text-align: center;'>1.00</td><td style='text-transform: uppercase;'>Servicios Contables Profesionales</td><td style='text-align: right; font-family: monospace;'>$" + comprobante.total.toFixed(2) + "</td><td style='text-align: right; font-family: monospace; font-weight: bold;'>$" + comprobante.total.toFixed(2) + "</td></tr>";
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita las ventanas emergentes (popups) para poder imprimir el RIDE.');
      return;
    }

    let regimeLabel = '';
    if (emisor.regimen === '1') regimeLabel = '<div style="font-size: 8px; font-weight: bold; color: #555; text-transform: uppercase; margin-top: 5px;">Contribuyente Régimen RIMPE - Negocio Popular</div>';
    else if (emisor.regimen === '2') regimeLabel = '<div style="font-size: 8px; font-weight: bold; color: #555; text-transform: uppercase; margin-top: 5px;">Contribuyente Régimen RIMPE</div>';

    const logoHtml = emisorLogo 
      ? "<img src='" + emisorLogo + "' class='logo-img' alt='Logo Emisor' />" 
      : "<div class='emisor-title' style='font-size: 16px; font-weight: 900; margin-bottom: 15px;'>" + (emisor.nombreComercial || 'EMISOR') + "</div>";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>RIDE Factura ${emisor.estab}-${emisor.ptoEmi}-${comprobante.secuencial}</title>
        <meta charset="utf-8" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;750&family=Manrope:wght@700;800&display=swap');
          
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 10px;
            color: #1e293b;
            margin: 25px;
            background: #ffffff;
            line-height: 1.5;
          }
          .ride-container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
          }
          .grid-container {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          .emisor-box {
            padding-right: 10px;
          }
          .logo-img {
            max-height: 70px;
            max-width: 220px;
            object-fit: contain;
            margin-bottom: 12px;
          }
          .emisor-title {
            font-family: 'Manrope', sans-serif;
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
            margin-bottom: 15px;
          }
          .emisor-name {
            font-family: 'Manrope', sans-serif;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #0f172a;
            margin-bottom: 5px;
          }
          .auth-box {
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 16px;
            background: #f8fafc;
            box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
          }
          .auth-title {
            font-size: 12px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 5px;
          }
          .auth-secuencial {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 750;
            color: #2b6aff;
            letter-spacing: 0.05em;
          }
          .auth-details {
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            margin-top: 10px;
          }
          .auth-details table {
            width: 100%;
            border-collapse: collapse;
          }
          .auth-details td {
            padding: 3px 0;
            vertical-align: top;
          }
          .auth-details td strong {
            color: #475569;
            font-size: 8.5px;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }
          .barcode-container {
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            margin-top: 10px;
            text-align: center;
          }
          .barcode-lines {
            height: 35px;
            width: 100%;
            margin: 6px 0;
            background: repeating-linear-gradient(
              90deg,
              #0f172a,
              #0f172a 2px,
              #fff 2px,
              #fff 4px,
              #0f172a 4px,
              #0f172a 6px,
              #fff 6px,
              #fff 7px
            );
            border-radius: 4px;
          }
          .barcode-text {
            font-family: 'JetBrains Mono', monospace;
            font-size: 8.5px;
            color: #475569;
            word-break: break-all;
            letter-spacing: 0.02em;
          }
          .receptor-box {
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: 1.3fr 1fr;
            gap: 10px;
            background: #ffffff;
            box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
          }
          .receptor-box strong {
            color: #64748b;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }
          .items-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-bottom: 20px;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            overflow: hidden;
          }
          .items-table th {
            background: #0f172a;
            color: #ffffff;
            text-transform: uppercase;
            font-size: 8.5px;
            font-weight: 600;
            padding: 10px 12px;
            border: none;
            letter-spacing: 0.05em;
          }
          .items-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #f1f5f9;
            border-right: 1px solid #f1f5f9;
          }
          .items-table td:last-child {
            border-right: none;
          }
          .items-table tr:last-child td {
            border-bottom: none;
          }
          .items-table tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .bottom-grid {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 20px;
          }
          .pago-box, .info-box {
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 15px;
            background: #ffffff;
            box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
          }
          .box-title {
            font-family: 'Manrope', sans-serif;
            font-weight: 700;
            text-transform: uppercase;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 6px;
            margin-bottom: 10px;
            font-size: 9.5px;
            color: #0f172a;
            letter-spacing: 0.05em;
          }
          .pago-table {
            width: 100%;
            border-collapse: collapse;
          }
          .pago-table th {
            color: #64748b;
            border-bottom: 1px solid #e2e8f0;
            padding: 4px;
            font-size: 8.5px;
            text-align: left;
            text-transform: uppercase;
          }
          .pago-table td {
            padding: 6px 4px;
          }
          .totals-box {
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 14px;
            background: #f8fafc;
            box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
          }
          .totals-table {
            width: 100%;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 5px 2px;
            border-bottom: 1px dashed #e2e8f0;
            font-size: 9.5px;
            color: #475569;
          }
          .totals-table tr:last-child td {
            border-bottom: none;
          }
          .totals-table tr.total-row {
            border-top: 1.5px solid #0f172a;
            font-weight: 700;
            font-size: 11.5px;
            color: #0f172a;
          }
          .totals-table tr.total-row td {
            color: #0f172a;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              margin: 15px;
            }
            .ride-container {
              width: 100%;
              max-width: 100%;
            }
            .auth-box, .receptor-box, .items-table, .pago-box, .info-box, .totals-box {
              box-shadow: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background: #0f172a; padding: 12px 20px; margin: -25px -25px 20px -25px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #2b6aff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
          <div style="color: white; font-family: sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px;">
            📄 Vista Previa RIDE - Comprobante Autorizado
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="window.print()" style="background: #2b6aff; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase; font-family: sans-serif;">
              🖨️ Imprimir / Guardar PDF
            </button>
            <button onclick="window.close()" style="background: #334155; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase; font-family: sans-serif;">
              Cerrar
            </button>
          </div>
        </div>
        <div class="ride-container">
          <div class="grid-container">
            <div class="emisor-box">
              ${logoHtml}
              <div class="emisor-name">${emisor.razonSocial}</div>
              <div style="color: #555; font-weight: 600;">${emisor.nombreComercial}</div>
              <div style="margin-top: 8px;"><strong>Dirección Matriz:</strong> ${emisor.dirMatriz}</div>
              <div style="margin-top: 8px;"><strong>OBLIGADO A LLEVAR CONTABILIDAD:</strong> NO</div>
              ${regimeLabel}
            </div>
            <div class="auth-box">
              <div class="auth-title">R.U.C.: <span style="font-family: monospace; font-size: 13px;">${emisor.ruc}</span></div>
              <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.5px; margin: 3px 0;">FACTURA</div>
              <div class="auth-secuencial">No. ${emisor.estab}-${emisor.ptoEmi}-${comprobante.secuencial}</div>
              <div class="auth-details">
                <table>
                  <tr>
                    <td style="width: 120px;"><strong>NÚMERO AUTORIZACIÓN:</strong></td>
                    <td style="font-family: monospace; font-size: 8.5px; word-break: break-all; color: #111;">${comprobante.claveAcceso}</td>
                  </tr>
                  <tr>
                    <td><strong>FECHA/HORA AUTORIZ.:</strong></td>
                    <td>${authDateStr}</td>
                  </tr>
                  <tr>
                    <td><strong>AMBIENTE:</strong></td>
                    <td style="text-transform: uppercase;">${emisor.ambiente}</td>
                  </tr>
                  <tr>
                    <td><strong>EMISIÓN:</strong></td>
                    <td>NORMAL</td>
                  </tr>
                </table>
              </div>
              <div class="barcode-container">
                <div style="font-size: 8px; font-weight: bold; color: #888; text-transform: uppercase;">Clave de Acceso</div>
                <div class="barcode-lines"></div>
                <div class="barcode-text">${comprobante.claveAcceso}</div>
              </div>
            </div>
          </div>
          <div class="receptor-box">
            <div>
              <strong>Razón Social / Nombres y Apellidos:</strong>
              <div style="margin-top: 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #111;">${receptor.razonSocial}</div>
            </div>
            <div>
              <strong>Identificación / RUC:</strong>
              <div style="margin-top: 3px; font-family: monospace; font-size: 11px; font-weight: bold;">${receptor.identificacion}</div>
            </div>
            <div style="margin-top: 4px;">
              <strong>Fecha Emisión:</strong> ${receptor.fechaEmision}
            </div>
            <div style="margin-top: 4px;">
              <strong>Guía de Remisión:</strong> S/N
            </div>
            <div style="grid-column: span 2; border-top: 1px dashed #ddd; padding-top: 4px; margin-top: 2px;">
              <strong>Dirección del Comprador:</strong> ${receptor.direccion}
            </div>
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 80px;">Cod. Principal</th>
                <th style="width: 50px; text-align: center;">Cant.</th>
                <th>Descripción</th>
                <th style="width: 100px; text-align: right;">P. Unitario</th>
                <th style="width: 100px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="bottom-grid">
            <div class="space-y-4">
              <div class="info-box">
                <div class="box-title">Información Adicional</div>
                <table style="width: 100%;">
                  <tr>
                    <td style="width: 100px; font-weight: bold; padding: 2px 0;">Dirección:</td>
                    <td style="color: #444; text-transform: uppercase;">${receptor.direccion}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; padding: 2px 0;">Email:</td>
                    <td style="color: #444;">${receptor.identificacion === buyerRuc ? buyerEmail || 'correo@cliente.com' : 'correo@cliente.com'}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; padding: 2px 0;">Teléfono:</td>
                    <td style="color: #444;">${receptor.identificacion === buyerRuc ? buyerPhone || '0999999999' : '0999999999'}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; padding: 2px 0;">Periodo Fiscal:</td>
                    <td style="color: #444; font-weight: bold; text-transform: uppercase;">${new Date(comprobante.fechaEmision).toLocaleString('es-EC', {month: 'long', year: 'numeric'}).toUpperCase()}</td>
                  </tr>
                </table>
              </div>
              <div class="pago-box">
                <div class="box-title">Forma de Pago</div>
                <table class="pago-table">
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th style="text-align: right; width: 80px;">Valor</th>
                      <th style="text-align: right; width: 50px;">Plazo</th>
                      <th style="text-align: right; width: 60px;">Tiempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="font-weight: 600; font-size: 8px;">${formaPagoDesc}</td>
                      <td style="text-align: right; font-family: monospace; font-weight: bold;">$${formaPagoTotal.toFixed(2)}</td>
                      <td style="text-align: right;">0</td>
                      <td style="text-align: right;">Días</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div class="totals-box">
                <table class="totals-table">
                  <tr>
                    <td>SUBTOTAL 15%</td>
                    <td style="text-align: right; font-family: monospace;">$${subtotal15.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>SUBTOTAL 0%</td>
                    <td style="text-align: right; font-family: monospace;">$${subtotal0.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>SUBTOTAL NO OBJETO IVA</td>
                    <td style="text-align: right; font-family: monospace;">$0.00</td>
                  </tr>
                  <tr>
                    <td>SUBTOTAL EXENTO IVA</td>
                    <td style="text-align: right; font-family: monospace;">$0.00</td>
                  </tr>
                  <tr>
                    <td>SUBTOTAL SIN IMPUESTOS</td>
                    <td style="text-align: right; font-family: monospace;">$${(subtotal15 + subtotal0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>DESCUENTO</td>
                    <td style="text-align: right; font-family: monospace;">$0.00</td>
                  </tr>
                  <tr>
                    <td>ICE</td>
                    <td style="text-align: right; font-family: monospace;">$0.00</td>
                  </tr>
                  <tr>
                    <td>IVA 15%</td>
                    <td style="text-align: right; font-family: monospace;">$${iva15.toFixed(2)}</td>
                  </tr>
                  <tr class="total-row">
                    <td>VALOR TOTAL</td>
                    <td style="text-align: right; font-family: monospace;">$${total.toFixed(2)}</td>
                  </tr>
                </table>
              </div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const copyToClipboard = (text: string, subject: string) => {
    navigator.clipboard.writeText(text);
    alert(`${subject} copiado al portapapeles.`);
  };

  const renderDashboard = () => {
    const totalIssued = history.length;
    const invoicesCount = history.filter(h => h.tipo === 'factura').length;
    const withholdingsCount = history.filter(h => h.tipo === 'retencion').length;
    const totalRevenue = history
      .filter(h => h.tipo === 'factura' && h.estado === 'Autorizado')
      .reduce((sum, h) => sum + h.total, 0);
    const latestDocs = history.slice(0, 5);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* Welcome Card */}
        <div className="glass-card-premium p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <div className="space-y-1 relative z-10">
            <span className="text-[9px] font-black uppercase tracking-wider text-primary">Mi Oficina</span>
            <h3 className="text-lg font-black uppercase tracking-wide text-slate-800 dark:text-white font-premium">
              {emisorRazonSocial || 'Emisor No Configurado'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
              RUC Emisor: <span className="font-mono">{emisorRuc || '0705787745001'}</span> — {emisorNombreComercial || 'SOLUCIONES CONTABLES PRO'}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 relative z-10 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('factura')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-gradient-azure text-white rounded-xl text-xs font-black uppercase tracking-wider font-premium transition-all shadow-sm shadow-primary/10 active:scale-[0.98]"
            >
              <Plus size={12} />
              Nueva Factura
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            onClick={() => setActiveTab('historial')}
            className="glass-card-premium p-5 space-y-2 cursor-pointer hover:border-primary/40 active:scale-[0.99] transition-all group"
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">Total Facturado (Autorizados)</span>
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-mono font-black text-slate-800 dark:text-white">${totalRevenue.toFixed(2)}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">USD</span>
            </div>
            <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
              Ingresos de facturas autorizadas por el SRI. Clic para ver historial.
            </div>
          </div>
          
          <div 
            onClick={() => setActiveTab('historial')}
            className="glass-card-premium p-5 space-y-2 cursor-pointer hover:border-primary/40 active:scale-[0.99] transition-all group"
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">Facturas Emitidas</span>
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-mono font-black text-slate-800 dark:text-white">{invoicesCount}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Docs</span>
            </div>
            <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
              Comprobantes de tipo factura en archivo. Clic para ver historial.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Latest Activity Table */}
          <div className="lg:col-span-8 glass-card-premium p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Comprobantes Recientes</h4>
            
            {latestDocs.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs font-bold text-slate-400 uppercase italic">
                Aún no hay comprobantes emitidos.
              </div>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <th className="pb-3 pr-2">Comprobante</th>
                      <th className="pb-3 pr-2">Receptor</th>
                      <th className="pb-3 pr-2">Fecha</th>
                      <th className="pb-3 pr-2">Total</th>
                      <th className="pb-3 text-center">Estado</th>
                      <th className="pb-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestDocs.map(doc => (
                      <tr 
                        key={doc.id} 
                        onClick={() => printRideDocument(doc)}
                        className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50/80 dark:hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        <td className="py-3 font-semibold pr-2">
                          <span className="uppercase text-[10px] font-black text-slate-700 dark:text-slate-300 block">
                            {doc.tipo === 'factura' ? 'Factura' : 'Retención'}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">{doc.secuencial}</span>
                        </td>
                        <td className="py-3 font-bold pr-2 truncate max-w-[155px] uppercase text-[10px]" title={doc.nombreReceptor}>
                          {doc.nombreReceptor}
                        </td>
                        <td className="py-3 text-slate-500 pr-2">{doc.fechaEmision}</td>
                        <td className="py-3 font-mono font-bold pr-2">${doc.total.toFixed(2)}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                            doc.estado === 'Autorizado'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : doc.estado === 'Rechazado' || doc.estado === 'Error'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            {doc.estado}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); printRideDocument(doc); }}
                              className="p-1 bg-slate-100 hover:bg-primary/20 dark:bg-white/5 dark:hover:bg-primary/20 text-slate-400 hover:text-primary rounded-lg transition-colors"
                              title="Imprimir PDF (RIDE)"
                            >
                              <FileText size={11} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); downloadXmlFile(doc); }}
                              className="p-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                              title="Descargar XML"
                            >
                              <Download size={11} />
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

          {/* Quick info widgets */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Connection widget */}
            <div className="glass-card-premium p-5 space-y-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Servidor API</span>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-500'
                }`}>
                  {connectionStatus === 'connected' ? <Wifi size={18} /> : <WifiOff size={18} />}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {connectionStatus === 'connected' ? 'Laravel Conectado' : 'Modo Simulación'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 truncate max-w-[150px]">{apiUrl}</span>
                </div>
              </div>
            </div>

            {/* Signature expiry warning */}
            <div className="glass-card-premium p-5 space-y-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vigencia Firma Electrónica</span>
              {p12FileBase64 ? (
                (() => {
                  const daysLeft = p12ExpiryDate ? Math.max(0, Math.ceil((new Date(p12ExpiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 365;
                  const pct = Math.min(100, Math.max(0, (daysLeft / 730) * 100)); // Out of 2 years (730 days)
                  const isExpiringSoon = daysLeft < 30;
                  const isExpired = daysLeft === 0;
                  
                  return (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-2 rounded-xl ${isExpired ? 'bg-rose-500/10 text-rose-500 animate-pulse' : 'bg-primary/10 text-primary'}`}>
                            <Lock size={15} />
                          </div>
                          <div className="flex flex-col text-left min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate max-w-[130px]">
                              {p12FileName || 'firma.p12'}
                            </span>
                            <span className="text-[8px] font-mono text-slate-400">Vence: {p12ExpiryDate || 'N/A'}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-lg ${isExpired ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                          {daysLeft} Días
                        </span>
                      </div>
                      
                      {/* Animated Progress Bar */}
                      <div className="space-y-1">
                        <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden relative">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${
                              isExpired 
                                ? 'from-rose-500 to-red-600' 
                                : isExpiringSoon 
                                ? 'from-amber-500 to-orange-400 animate-pulse' 
                                : 'from-emerald-500 to-teal-400 animate-pulse'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">
                          <span>Vigencia</span>
                          <span>{pct.toFixed(0)}% restante</span>
                        </div>
                      </div>
                      
                      <div className="text-[8.5px] font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-white/5 pt-2">
                        Propietario: <span className="font-bold text-slate-700 dark:text-slate-300 uppercase block truncate">{p12SubjectName || emisorRazonSocial}</span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-center space-y-2">
                  <div className="p-2 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-xl w-fit mx-auto animate-bounce">
                    <AlertTriangle size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 block">Firma no configurada</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('configuracion')}
                    className="text-[9px] font-black uppercase tracking-wider text-primary hover:underline"
                  >
                    Configurar Ahora
                  </button>
                </div>
              )}
            </div>

            {/* Protocolo de Conectividad & Enlaces widget */}
            <div className="glass-card-premium p-5 space-y-3.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Guía de Acceso & Enlaces SRI</span>
              
              {/* Protocol info */}
              <div className="space-y-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-400">
                <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl space-y-1.5 border border-slate-100 dark:border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">Facturación Local (Actual)</span>
                  <div>🌐 <strong>Interfaz:</strong> <span className="font-mono">localhost:3000</span></div>
                  <div>🔌 <strong>Firmador:</strong> <span className="font-mono">localhost:8000</span> (Laravel API)</div>
                </div>

                <div className="bg-primary/5 dark:bg-primary/10 p-3 rounded-xl space-y-1.5 border border-primary/10">
                  <span className="text-[9px] font-black uppercase tracking-wider text-primary block">Facturación Cloud (Render)</span>
                  <div>🚀 <strong>Dominio:</strong> <span className="font-mono">santiagocordova.com</span></div>
                  <div className="text-[9px] opacity-75">No requerirá correr comandos locales. Todo se procesará seguro en la nube.</div>
                </div>
              </div>

              {/* Quick links */}
              <div className="pt-2 border-t border-slate-200 dark:border-white/5 space-y-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">Portales Oficiales SRI</span>
                
                <a
                  href="https://srienlinea.sri.gob.ec/sri-enlinea/pages/comprobantesElectronicos/svalidezComprobantes.jsf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-wider font-premium transition-all"
                >
                  <span>Consulta Validez SRI</span>
                  <ExternalLink size={10} className="text-primary" />
                </a>

                <a
                  href="https://srienlinea.sri.gob.ec/sri-enlinea-pruebas/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-wider font-premium transition-all"
                >
                  <span>SRI en Línea (Pruebas)</span>
                  <ExternalLink size={10} className="text-primary" />
                </a>
              </div>
            </div>
          </div>

          </div>
        </div>
    );
  };

  const renderUpcomingDocument = (title: string, desc: string) => {
    return (
      <div className="glass-card-premium p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-lg mx-auto py-16 animate-in fade-in duration-300">
        <div className="p-4 bg-primary/10 rounded-full text-primary animate-pulse">
          <FileText size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black uppercase tracking-wider text-slate-800 dark:text-white font-premium">
            {title}
          </h3>
          <span className="px-2 py-0.5 bg-primary/15 border border-primary/25 text-primary rounded-lg text-[9px] font-black uppercase tracking-widest block w-fit mx-auto font-sans">
            Próximamente en Frontend
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed max-w-sm pt-2">
            {desc}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-[10px] text-slate-500 font-mono border border-slate-200 dark:border-white/5 max-w-sm">
          El backend en Laravel ya tiene implementada la firma XAdES-BES y la generación de este documento. La interfaz gráfica se habilitará en la siguiente actualización.
        </div>
      </div>
    );
  };

  const handleSaveSettings = () => {
    localStorage.setItem('sc_emisor_ruc', emisorRuc);
    localStorage.setItem('sc_emisor_razon', emisorRazonSocial);
    localStorage.setItem('sc_emisor_comercial', emisorNombreComercial);
    localStorage.setItem('sc_emisor_dir', emisorDirMatriz);
    localStorage.setItem('sc_emisor_estab', emisorEstab);
    localStorage.setItem('sc_emisor_pto', emisorPtoEmi);
    localStorage.setItem('sc_emisor_regimen', emisorRegimen);
    localStorage.setItem('sc_emisor_ambiente', ambiente);
    localStorage.setItem('sc_facturacion_api_url', apiUrl);
    localStorage.setItem('sc_emisor_secuencial_inicio', String(emisorSecuencialInicio));
    localStorage.setItem('sc_emisor_logo', emisorLogo);
    alert('Ajustes del emisor y API guardados correctamente.');
    setActiveTab('dashboard');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-120px)] relative">
      
      {/* 1. Sidebar Nav (Internal Nested Sidebar) */}
      <div className="lg:w-[260px] w-full shrink-0">
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="glass-card-premium p-4 space-y-6">
            
            {/* Header: Workspace title */}
            <div className="flex items-center gap-3 px-2 border-b border-slate-200 dark:border-white/5 pb-4">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <FileText size={18} />
              </div>
              <div className="flex flex-col text-left font-premium">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Facturación</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">SRI offline v1.0</span>
              </div>
            </div>
            
            {/* Menu Options */}
            <div className="space-y-4">
              
              {/* Category: General */}
              <div className="space-y-1">
                <span className="px-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-2">Mi Oficina</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider font-premium transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 dark:text-slate-400'
                  }`}
                >
                  <Home size={14} />
                  <span>Escritorio</span>
                </button>
              </div>

              {/* Category: Emisión */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setIsFacturacionOpen(!isFacturacionOpen)}
                  className="w-full flex items-center justify-between px-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <span>Emisión SRI</span>
                  {isFacturacionOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
                
                {isFacturacionOpen && (
                  <div className="space-y-1 pl-1 border-l border-slate-100 dark:border-white/5 ml-2">
                    {[
                      { id: 'factura', label: 'Factura', badge: null },
                      { id: 'nota_credito', label: 'Nota Crédito', badge: null },
                      { id: 'nota_debito', label: 'Nota Débito', badge: null },
                      { id: 'guia', label: 'Guía Remisión', badge: null },
                      { id: 'liquidacion', label: 'Liquidación', badge: null }
                    ].map(sub => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setActiveTab(sub.id as any)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                          activeTab === sub.id
                            ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-black'
                            : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-400'
                        }`}
                      >
                        <span className="truncate">{sub.label}</span>
                        {sub.badge && (
                          <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-[8px] font-bold text-slate-400 rounded-md shrink-0 scale-90 font-sans">
                            {sub.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category: Archivo */}
              <div className="space-y-1">
                <span className="px-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-2">Historial</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('historial')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider font-premium transition-all ${
                    activeTab === 'historial'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 dark:text-slate-400'
                  }`}
                >
                  <Database size={14} />
                  <span>Historial XML</span>
                </button>
              </div>

              {/* Category: Herramientas */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setIsHerramientasOpen(!isHerramientasOpen)}
                  className="w-full flex items-center justify-between px-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <span>Herramientas</span>
                  {isHerramientasOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
                
                {isHerramientasOpen && (
                  <div className="space-y-1 pl-1 border-l border-slate-100 dark:border-white/5 ml-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('validador')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                        activeTab === 'validador'
                          ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-black'
                          : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-400'
                      }`}
                    >
                      <CheckCircle2 size={12} />
                      <span>Validar RUC/Cédula</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('configuracion')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                        activeTab === 'configuracion'
                          ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-black'
                          : 'text-slate-500 hover:bg-slate-55 dark:hover:bg-white/5 dark:text-slate-400'
                      }`}
                    >
                      <Settings size={12} />
                      <span>Ajustes Emisor & API</span>
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Bottom Status Block */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/5">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-left space-y-1 font-sans">
                <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Firma Electrónica</span>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block leading-tight">
                  {p12FileBase64 ? '✓ Firma Configurada y Activa' : '⚠️ Pendiente de configurar'}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className={`flex-1 min-w-0 space-y-6 ${(activeTab === 'factura' || activeTab === 'retencion') ? 'pb-28' : ''}`}>
        
        {/* Dynamic top bar inside content area to show connection status */}
        {activeTab !== 'dashboard' && (
          <div className="glass-card-premium p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                {activeTab === 'factura' ? <FileText size={18} /> : activeTab === 'retencion' ? <CreditCard size={18} /> : <Sliders size={18} />}
              </div>
              <div className="flex flex-col text-left font-premium">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">
                  {activeTab === 'factura' ? 'Nueva Factura Electrónica' : activeTab === 'retencion' ? 'Comprobante de Retención' : activeTab === 'validador' ? 'Validador SRI' : activeTab === 'configuracion' ? 'Ajustes del Emisor' : 'Historial Comprobantes'}
                </h2>
                <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 font-sans">
                  Emisor: {emisorRazonSocial || 'No configurado'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-center">
              {(activeTab === 'factura' || activeTab === 'retencion') && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-gradient-azure text-white rounded-xl text-[9px] font-black uppercase tracking-wider font-premium transition-all shadow-sm shadow-primary/10 active:scale-[0.98]"
                  >
                    <span>Acciones</span>
                    <ChevronDown size={10} />
                  </button>
                  {isActionsDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsActionsDropdownOpen(false)} />
                      <div className="absolute right-0 mt-1.5 glass-card-premium rounded-xl  overflow-hidden z-50 w-44 p-1.5 space-y-0.5 animate-in fade-in duration-200">
                        <button
                          type="button"
                          onClick={() => {
                            handleResetForm();
                            setIsActionsDropdownOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200"
                        >
                          Limpiar Formulario
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleLoadMockData();
                            setIsActionsDropdownOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[10px] font-black uppercase tracking-wider text-primary"
                        >
                          Simular Datos Prueba
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider font-premium transition-all ${
                connectionStatus === 'connected' 
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
              }`}>
                {connectionStatus === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
                <span>{connectionStatus === 'connected' ? 'Laravel Online' : 'Offline'}</span>
              </div>
              
              <button 
                onClick={() => {
                  const nextAmb = ambiente === '1' ? '2' : '1';
                  setAmbiente(nextAmb);
                }}
                className={`text-[9px] font-black border rounded-xl px-3 py-1.5 uppercase font-premium font-sans cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm flex items-center gap-1.5 ${
                  ambiente === '2'
                    ? 'bg-[#04B17B]/15 border-[#04B17B]/40 text-[#04B17B] dark:text-emerald-400'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                }`}
                title="Haz clic aquí para cambiar al instante entre Ambiente 1 (Pruebas) y Ambiente 2 (Producción)"
              >
                <span className={`w-2 h-2 rounded-full ${ambiente === '2' ? 'bg-[#04B17B] animate-pulse' : 'bg-amber-500'}`} />
                Ambiente: {ambiente === '1' ? '1 (PRUEBAS)' : '2 (PRODUCCIÓN)'}
              </button>
            </div>
          </div>
        )}

        {/* Connection warning banner */}
        {connectionStatus !== 'connected' && (activeTab === 'factura' || activeTab === 'retencion') && (
          <div className="bg-rose-500/10 border border-rose-500/25 text-rose-500 p-4 rounded-[1.5rem] text-xs font-semibold flex items-center justify-between gap-3 animate-pulse text-left relative z-20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500 shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <strong className="block text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Modo Simulación Activo</strong>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  El facturador no está conectado a la API ({apiUrl}). Los comprobantes no se transmitirán al SRI real.
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button 
                type="button"
                onClick={() => {
                  const altUrl = apiUrl === 'https://facturador-sri-api.onrender.com' ? 'http://localhost:8000' : 'https://facturador-sri-api.onrender.com';
                  setApiUrl(altUrl);
                  localStorage.setItem('sc_facturacion_api_url', altUrl);
                  checkBackendConnection(altUrl);
                }}
                className="px-3.5 py-2 bg-slate-800 dark:bg-white/10 hover:bg-slate-700 dark:hover:bg-white/20 text-white rounded-xl font-black uppercase tracking-wider text-[9px] transition-all"
              >
                {apiUrl === 'https://facturador-sri-api.onrender.com' ? 'Usar Local (8000)' : 'Usar Nube (Render)'}
              </button>
              <button 
                type="button"
                onClick={() => checkBackendConnection()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase tracking-wider text-[9px] transition-all active:scale-[0.98]"
              >
                Reconectar
              </button>
            </div>
          </div>
        )}

        {/* Views Router */}
        {activeTab === 'dashboard' && renderDashboard()}
        
        {activeTab === 'nota_credito' && renderUpcomingDocument('Nota de Crédito Electrónica', 'Permite anular o aplicar descuentos/modificaciones a facturas emitidas y autorizadas previamente en el SRI.')}
        {activeTab === 'nota_debito' && renderUpcomingDocument('Nota de Débito Electrónica', 'Permite cobrar intereses, multas o cargos adicionales que aumenten el valor original de una factura.')}
        {activeTab === 'guia' && renderUpcomingDocument('Guía de Remisión Electrónica', 'Soporte oficial del SRI para el traslado de mercaderías por vía terrestre dentro del territorio nacional.')}
        {activeTab === 'liquidacion' && renderUpcomingDocument('Liquidación de Compra', 'Comprobante emitido a proveedores que por su nivel cultural o rusticidad no pueden emitir facturas.')}

        {activeTab === 'configuracion' && (
          <div className="glass-card-premium p-6 space-y-6 animate-fade-in relative z-20">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-3 font-premium">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                <Settings size={14} className="text-primary animate-pulse" />
                Configuración de API & Emisor
              </h3>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
              >
                <Save size={12} />
                Guardar Ajustes
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Datos de Facturación del Emisor (Compañía)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Razón Social</label>
                    <input
                      type="text"
                      value={emisorRazonSocial}
                      onChange={(e) => setEmisorRazonSocial(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Nombre Comercial</label>
                    <input
                      type="text"
                      value={emisorNombreComercial}
                      onChange={(e) => setEmisorNombreComercial(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">RUC Emisor</label>
                    <input
                      type="text"
                      value={emisorRuc}
                      onChange={(e) => setEmisorRuc(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono font-semibold outline-none focus:border-primary text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Dirección Matriz</label>
                    <input
                      type="text"
                      value={emisorDirMatriz}
                      onChange={(e) => setEmisorDirMatriz(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Cód. Establecimiento</label>
                    <input
                      type="text"
                      value={emisorEstab}
                      onChange={(e) => setEmisorEstab(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Cód. Punto Emisión</label>
                    <input
                      type="text"
                      value={emisorPtoEmi}
                      onChange={(e) => setEmisorPtoEmi(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Régimen SRI</label>
                    <select
                      value={emisorRegimen}
                      onChange={(e) => setEmisorRegimen(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none text-slate-800 dark:text-slate-100"
                    >
                      <option value="0">RÉGIMEN GENERAL</option>
                      <option value="3">RIMPE NEGOCIO POPULAR</option>
                      <option value="2">RIMPE EMPRENDEDOR</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Ambiente de Trabajo</label>
                    <select
                      value={ambiente}
                      onChange={(e) => setAmbiente(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none text-slate-800 dark:text-slate-100"
                    >
                      <option value="1">1 - PRUEBAS</option>
                      <option value="2">2 - PRODUCCIÓN</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Secuencial Inicio Factura</label>
                    <input
                      type="number"
                      min="1"
                      value={emisorSecuencialInicio}
                      onChange={(e) => setEmisorSecuencialInicio(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono font-semibold outline-none focus:border-primary text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Logo del Emisor (Impresión RIDE)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const result = event.target?.result as string;
                              setEmisorLogo(result);
                              localStorage.setItem('sc_emisor_logo', result);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                        id="logo-upload-input-config"
                      />
                      <label
                        htmlFor="logo-upload-input-config"
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer border-dashed border-2 hover:border-primary"
                      >
                        <Download size={13} className="text-primary shrink-0" />
                        Subir Logo
                      </label>
                      {emisorLogo && (
                        <div className="relative shrink-0 w-10 h-10 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden group">
                          <img src={emisorLogo} alt="Logo" className="w-full h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => {
                              setEmisorLogo('');
                              localStorage.removeItem('sc_emisor_logo');
                            }}
                            className="absolute inset-0 bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                            title="Eliminar logo"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Servidor Laravel API (Protegido)</h4>

                <div className="space-y-4 font-premium">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                      <Sliders size={10} className="text-primary" />
                      Servidor de Firmador & Autorización (SRI API)
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl mb-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setApiUrl('https://facturador-sri-api.onrender.com');
                          checkBackendConnection('https://facturador-sri-api.onrender.com');
                        }}
                        className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                          apiUrl === 'https://facturador-sri-api.onrender.com'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
                        }`}
                      >
                        Nube (Render)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setApiUrl('http://localhost:8000');
                          checkBackendConnection('http://localhost:8000');
                        }}
                        className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                          apiUrl.includes('localhost:8000') || apiUrl.includes('127.0.0.1:8000')
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
                        }`}
                      >
                        Local (Port 8000)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const customUrl = prompt('Ingrese URL de API personalizada (ej: https://sri.miempresa.com):');
                          if (customUrl) {
                            setApiUrl(customUrl);
                            checkBackendConnection(customUrl);
                          }
                        }}
                        className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                          apiUrl !== 'https://facturador-sri-api.onrender.com' && !apiUrl.includes('localhost:8000') && !apiUrl.includes('127.0.0.1:8000')
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
                        }`}
                      >
                        Personalizar
                      </button>
                    </div>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold font-mono text-slate-800 dark:text-slate-100 outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Prefijo de la API</label>
                    <input
                      type="text"
                      value={apiPrefix}
                      onChange={(e) => setApiPrefix(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-primary font-mono text-slate-800 dark:text-slate-100"
                      placeholder="/api/v1"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => checkBackendConnection(apiUrl)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      <RefreshCw size={12} className={connectionStatus === 'checking' ? 'animate-spin' : ''} />
                      Verificar Conexión
                    </button>
                  </div>
                </div>

                {/* Firma Electrónica (.p12) */}
                <div className="pt-6 border-t border-slate-200 dark:border-white/5 space-y-4 font-premium">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Key size={12} className="text-primary animate-pulse" />
                      Firma Electrónica (.p12)
                    </h4>
                    {p12FileBase64 ? (
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                        <Check size={8} />
                        Cargada
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                        <AlertTriangle size={8} />
                        Faltante
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Archivo Certificado */}
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                        Archivo de Firma (.p12)
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".p12"
                          onChange={handleP12Upload}
                          className="hidden"
                          id="p12-upload-input-config"
                        />
                        <label
                          htmlFor="p12-upload-input-config"
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer border-dashed border-2 hover:border-primary"
                        >
                          <Download size={13} className="text-primary" />
                          <span className="truncate max-w-[150px]">{p12FileName || 'Subir Archivo .p12'}</span>
                        </label>
                      </div>
                    </div>

                    {/* Contraseña de la Firma */}
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                        Contraseña de la Firma
                      </label>
                      <div className="relative">
                        <input
                          type={showP12Password ? 'text' : 'password'}
                          value={p12Password}
                          onChange={(e) => {
                            setP12Password(e.target.value);
                            localStorage.setItem('sc_sri_p12_password', e.target.value);
                          }}
                          placeholder="Escriba la clave..."
                          className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none focus:border-primary text-slate-800 dark:text-slate-100 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowP12Password(!showP12Password)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                        >
                          {showP12Password ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Expiry metadata info */}
                    {p12ExpiryDate && (
                      <div className={`flex flex-col gap-1 p-3 rounded-xl ${
                        p12SubjectName.includes('VENCIDO') 
                          ? 'bg-rose-100/40 dark:bg-rose-950/20 border border-rose-500/10 text-rose-600 dark:text-rose-400'
                          : p12SubjectName.includes('Vence en')
                          ? 'bg-amber-100/40 dark:bg-amber-950/20 border border-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-100/40 dark:bg-emerald-950/20 border border-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        <span className="text-xs font-semibold">📅 Vence: <span className="font-mono">{p12ExpiryDate}</span></span>
                        {p12SubjectName && <span className="text-[10px] font-black uppercase tracking-wider opacity-90">{p12SubjectName}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Guía rápida de facturación real */}
            <div className="border-t border-slate-200 dark:border-white/10 pt-6 mt-6">
              <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5 font-premium">
                  <Info size={14} />
                  Guía Rápida para Facturación Real en Ecuador (SRI)
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                  Para emitir comprobantes electrónicos que tengan validez legal y aparezcan en el SRI de producción:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-[10px] leading-relaxed text-slate-600 dark:text-slate-400">
                  <div className="space-y-1 bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-white/5">
                    <strong className="text-slate-800 dark:text-white block font-bold">1. Conexión Laravel API</strong>
                    <span>El indicador superior izquierdo debe decir <strong className="text-emerald-500">Laravel Online</strong>. Si dice Offline, la API local no está respondiendo y el sistema simulará los datos.</span>
                  </div>
                  <div className="space-y-1 bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-white/5">
                    <strong className="text-slate-800 dark:text-white block font-bold">2. Firma Electrónica</strong>
                    <span>Sube tu archivo de firma <strong className="text-mono">.p12</strong> real y escribe su contraseña correcta. Esto se guardará localmente en tu navegador.</span>
                  </div>
                  <div className="space-y-1 bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-white/5">
                    <strong className="text-slate-800 dark:text-white block font-bold">3. Ambiente Producción</strong>
                    <span>Cambia el <strong>Ambiente de Trabajo</strong> a <strong className="text-slate-800 dark:text-white">2 - PRODUCCIÓN</strong> en los campos de arriba y haz clic en Guardar Ajustes.</span>
                  </div>
                  <div className="space-y-1 bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-white/5">
                    <strong className="text-slate-800 dark:text-white block font-bold">4. Validar en SRI</strong>
                    <span>Tus facturas ahora viajarán al SRI real. Las podrás consultar inmediatamente en el portal oficial de comprobantes electrónicos del SRI.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'factura' || activeTab === 'retencion') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel - Form */}
          <div className="lg:col-span-7 space-y-6">
                        {/* PANEL DE CONTROL DE EMISIÓN (SUPERIOR) */}
            <div className="glass-card-premium p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t-4 border-t-primary relative overflow-hidden bg-slate-900/40 dark:bg-white/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl -mr-6 -mt-6"></div>
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
                  <Sliders size={18} />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white font-premium">
                    Control de Emisión
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                    Modo: <span className="text-primary font-bold">{docType === 'factura' ? 'Factura' : 'Retención'}</span> | Ambiente: <span className="text-primary font-bold">{ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS'}</span> | Siguiente Secuencial: <span className="text-emerald-500 font-mono font-bold">{String(Math.max(emisorSecuencialInicio, getMaxSecuencialInHistory(docType) + 1)).padStart(9, '0')}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 justify-end relative z-10">
                {/* Reset Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient('');
                    setClientSearchQuery('');
                    setSelectedPeriods([]);
                    setBuyerName('');
                    setBuyerRuc('');
                    setBuyerEmail('');
                    setBuyerPhone('');
                    setBuyerAddress('');
                    if (docType === 'factura') {
                      setInvoiceItems([
                        {
                          id: '1',
                          codigoPrincipal: '001',
                          descripcion: 'Asesoría Tributaria Mensual Profesional',
                          cantidad: 1,
                          precioUnitario: 120.00,
                          ivaRate: emisorRegimen === '3' ? 0.00 : 0.15,
                          subtotal: 120.00,
                          iva: emisorRegimen === '3' ? 0.00 : 18.00,
                          total: emisorRegimen === '3' ? 120.00 : 138.00
                        }
                      ]);
                    } else {
                      setWithholdings([
                        {
                          id: '1',
                          baseImponible: 100.00,
                          codDocSustento: '01',
                          numDocSustento: '001-001-000004567',
                          fechaEmisionDocSustento: new Date().toISOString().split('T')[0],
                          tipoRetencion: '1',
                          codigoRetencion: '343',
                          porcentajeRetener: 10.0,
                          valorRetenido: 10.0
                        }
                      ]);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider font-premium transition-all active:scale-[0.98]"
                >
                  <Trash2 size={11} />
                  Limpiar Formulario
                </button>

                {/* Process Button */}
                <button
                  type="button"
                  onClick={handleProcessDocument}
                  disabled={
                    processStatus === 'running' || 
                    (!selectedClient && (!buyerName.trim() || !buyerRuc.trim())) || 
                    (docType === 'factura' ? invoiceItems.length === 0 : withholdings.length === 0)
                  }
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-gradient-azure disabled:bg-slate-100 dark:disabled:bg-white/5 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider font-premium shadow-primary active:scale-[0.99] transition-all"
                >
                  {processStatus === 'running' ? (
                    <>
                      <RefreshCw size={11} className="animate-spin" />
                      Enviando SRI...
                    </>
                  ) : (
                    <>
                      <Play size={11} fill="currentColor" />
                      Procesar y Autorizar
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* SECCIÓN 1: DATOS DEL CLIENTE / RECEPTOR */}
            <div className="glass-card-premium p-6 space-y-6 border-t-4 border-t-primary relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl -mr-6 -mt-6"></div>
              
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-white/5 relative z-10">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <User size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white font-premium">
                    1. Datos del Cliente / Receptor
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Búsqueda y datos del receptor</p>
                </div>
              </div>

              {/* Client Searchable Selector */}
              <div className="relative">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex justify-between items-center">
                  <span>Seleccionar Cliente para Facturar</span>
                  {selectedClient && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClient('');
                        setClientSearchQuery('');
                        setSelectedPeriods([]);
                      }}
                      className="text-[9px] text-rose-500 hover:text-rose-600 font-bold uppercase tracking-wider transition-colors"
                    >
                      Limpiar Selección
                    </button>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => {
                      setClientSearchQuery(e.target.value);
                      setIsClientDropdownOpen(true);
                      if (selectedClient && e.target.value !== activeClientObj?.name) {
                        setSelectedClient('');
                        setSelectedPeriods([]);
                      }
                    }}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary transition-all font-semibold uppercase tracking-wide"
                    placeholder="Escriba RUC o nombre del cliente..."
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                </div>
                
                {isClientDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsClientDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-white/10 shadow-2xl rounded-xl overflow-hidden z-50 max-h-[200px] overflow-y-auto no-scrollbar">
                      {filteredClientsForSearch.length > 0 ? (
                        <div className="p-1.5 space-y-0.5">
                          {filteredClientsForSearch.map(c => (
                            <button
                              type="button"
                              key={c.id}
                              onClick={() => selectClientAndInitialize(c.id)}
                              className="w-full text-left px-3.5 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-between text-xs font-semibold"
                            >
                              <div className="flex flex-col">
                                <span className="text-slate-800 dark:text-slate-200 uppercase truncate max-w-[280px]">
                                  {c.tradeName || c.name}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400 mt-0.5">RUC: {c.ruc}</span>
                              </div>
                              <ChevronRight size={12} className="text-slate-400" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-5 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Sin clientes encontrados
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Obligaciones y Saldos Pendientes (Inventario) */}
              {selectedClient && pendingObligations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 space-y-3 animate-fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <AlertCircle size={12} className="text-primary animate-pulse" />
                      Saldo de Declaraciones Pendientes ({pendingObligations.length})
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPeriods(pendingObligations.map(o => o.id))}
                        className="text-[9px] font-black uppercase tracking-wider text-primary hover:text-primary-hover transition-colors"
                      >
                        Todos
                      </button>
                      <span className="text-slate-300 dark:text-white/10">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPeriods([])}
                        className="text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        Ninguno
                      </button>
                      <div className="ml-2 flex items-center gap-1 bg-slate-100 dark:bg-black/20 p-1 rounded-xl border border-slate-200/50 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => setBillingMode('detallado')}
                          className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider transition-all rounded-lg ${
                            billingMode === 'detallado' 
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Detallado
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingMode('consolidado')}
                          className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider transition-all rounded-lg ${
                            billingMode === 'consolidado' 
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Consolidado
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 font-semibold leading-relaxed uppercase tracking-wider">
                    Marque los meses para auto-generar la factura. El detalle se calculará con su tarifa respectiva.
                    {selectedPeriods.length > 0 && (
                      <span className="ml-2 text-primary font-black">
                        ({selectedPeriods.length} seleccionados — ${pendingObligations
                          .filter(o => selectedPeriods.includes(o.id))
                          .reduce((s, o) => s + o.amount, 0)
                          .toFixed(2)})
                      </span>
                    )}
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[180px] overflow-y-auto no-scrollbar pr-1 pt-1">
                    {pendingObligations.map(ob => {
                      const isChecked = selectedPeriods.includes(ob.id);
                      return (
                        <label
                          key={ob.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                            isChecked
                              ? 'border-primary/50 bg-primary/5 dark:bg-primary/10 shadow-sm scale-[1.01]'
                              : 'border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/10'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPeriods([...selectedPeriods, ob.id]);
                              } else {
                                setSelectedPeriods(selectedPeriods.filter(id => id !== ob.id));
                              }
                            }}
                            className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate uppercase tracking-wide">
                              {ob.label}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">
                              Período: {formatPeriodForDisplay(ob.period).replace('IVA ', '')}
                            </p>
                          </div>
                          <span className="text-xs font-black text-primary font-mono shrink-0">
                            ${ob.amount.toFixed(2)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Formulario de Campos Manuales del Receptor */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Detalles de Identificación y Contacto</h4>
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
                      onChange={(e) => {
                        const val = e.target.value;
                        setBuyerIdType(val);
                        if (val === '07') {
                          setBuyerRuc('9999999999999');
                          setBuyerName('CONSUMIDOR FINAL');
                        } else if (buyerRuc === '9999999999999') {
                          setBuyerRuc('');
                          setBuyerName('');
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-primary font-semibold text-slate-800 dark:text-slate-100"
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
            </div>

            {/* SECCIÓN 2: DETALLES DE PRODUCTOS / SERVICIOS */}
            {docType === 'factura' && (
              <div className="glass-card-premium p-6 space-y-6 border-t-4 border-t-primary relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl -mr-6 -mt-6"></div>
                
                <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-white/5 relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                      <FileText size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white font-premium">
                        2. Detalles de Productos y Servicios
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Grilla de ítems facturados</p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={addInvoiceItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-gradient-azure text-white rounded-xl text-[10px] font-black uppercase tracking-wider font-premium transition-all active:scale-[0.98]"
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
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Cód. Producto/Servicio</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={item.codigoPrincipal}
                            onChange={(e) => updateInvoiceItem(item.id, 'codigoPrincipal', e.target.value.replace(/\D/g, ''))}
                            placeholder="001"
                            className="w-full px-3 py-2 mt-1 glass-card-premium rounded-xl text-xs font-semibold font-mono text-slate-700 dark:text-slate-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-center tracking-widest"
                          />
                        </div>
                        <div className="md:col-span-9">
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Descripción del Artículo / Servicio</label>
                          <textarea
                            value={item.descripcion}
                            onChange={(e) => updateInvoiceItem(item.id, 'descripcion', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 mt-1 glass-card-premium rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none leading-relaxed"
                            placeholder="Describa el servicio prestado..."
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Cantidad</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.cantidad}
                            onChange={(e) => updateInvoiceItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 mt-1 glass-card-premium rounded-xl text-xs font-bold font-mono text-slate-800 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Precio Unitario</label>
                          <input
                            type="number"
                            min="0.00"
                            step="0.01"
                            value={item.precioUnitario}
                            onChange={(e) => updateInvoiceItem(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 mt-1 glass-card-premium rounded-xl text-xs font-bold font-mono text-slate-800 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Tarifa IVA</label>
                          <select
                            value={item.ivaRate}
                            onChange={(e) => updateInvoiceItem(item.id, 'ivaRate', parseFloat(e.target.value))}
                            disabled={emisorRegimen === '3'}
                            className="w-full px-3 py-2 mt-1 glass-card-premium rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {emisorRegimen === '3' ? (
                              <option value="0.00">0% (RIMPE NP)</option>
                            ) : (
                              <>
                                <option value="0.15">15% IVA</option>
                                <option value="0.00">0% IVA</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div className="col-span-3 md:col-span-1">
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Total Ítem</label>
                          <div className="w-full px-3 py-2 mt-1 bg-slate-200/40 dark:bg-slate-900/40 rounded-xl text-xs font-mono font-black text-right text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-white/5">
                            ${item.total.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECCIÓN 3: FORMA DE PAGO Y RESUMEN DE TOTALES */}
            {docType === 'factura' && (
              <div className="glass-card-premium p-6 space-y-6 border-t-4 border-t-primary relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl -mr-6 -mt-6"></div>
                
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-white/5 relative z-10">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white font-premium">
                      3. Forma de Pago & Totales
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Método de cobro y totales de factura</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Forma de Pago */}
                  <div className="lg:col-span-6 space-y-3 text-left">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Seleccione la Forma de Pago</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { value: '01', label: 'Efectivo', icon: '💵', sub: 'Sin sistema financiero' },
                        { value: '20', label: 'Transferencia', icon: '🏦', sub: 'Sistema financiero' },
                        { value: '19', label: 'Tarjeta', icon: '💳', sub: 'Crédito / Débito' },
                        { value: '17', label: 'Digital', icon: '📱', sub: 'Dinero electrónico' }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormaPago(opt.value)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                            formaPago === opt.value
                              ? 'border-primary bg-primary/5 dark:bg-primary/10 text-primary font-black shadow-sm'
                              : 'border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/10 text-slate-600 dark:text-slate-300 font-bold'
                          }`}
                        >
                          <span className="text-lg shrink-0">{opt.icon}</span>
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-wider ${
                              formaPago === opt.value ? 'text-primary' : 'text-slate-700 dark:text-slate-200'
                            }`}>{opt.label}</p>
                            <p className="text-[8px] text-slate-400 font-semibold">{opt.sub}</p>
                          </div>
                          {formaPago === opt.value && <Check size={12} className="ml-auto shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resumen de Totales */}
                  <div className="lg:col-span-6 bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 rounded-2xl p-4 space-y-2.5 flex flex-col justify-center text-left">
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
                      <span className="font-mono text-primary text-base">${invoiceTotals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}



            {/* Workflow Control steps */}
            <div className="glass-card-premium p-6 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Ciclo de Emisión SRI</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
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

              <div className="pt-2 text-center">
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider block">
                  Use el botón azul "PROCESAR Y AUTORIZAR" en la barra inferior para transmitir
                </span>
              </div>
            </div>

          </div>

          {/* Right panel - Logs & Code output */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live Terminal Log or Success Action Panel */}
            {processStatus === 'success' ? (
              <div className="glass-card-premium p-6 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/20 rounded-[2rem] flex flex-col justify-between h-[280px] relative overflow-hidden animate-fade-in text-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={20} className="animate-bounce" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Factura Autorizada</h4>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">Estado: AUTORIZADO (SRI)</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 font-mono text-[9px] text-slate-600 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                    <div>SEC: <span className="font-bold text-slate-800 dark:text-slate-200">{generatedAccessKey ? generatedAccessKey.substring(30, 39) : '000000001'}</span></div>
                    <div className="truncate">CLAVE: <span className="text-[8px]">{generatedAccessKey}</span></div>
                    <div>TOTAL: <span className="font-bold text-primary">${invoiceTotals.total.toFixed(2)}</span></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2 relative z-10">
                  <button
                    onClick={() => {
                      const currentComp: HistoricComprobante = {
                        id: Date.now().toString(),
                        tipo: docType,
                        secuencial: generatedAccessKey ? generatedAccessKey.substring(30, 39) : '000000001',
                        claveAcceso: generatedAccessKey,
                        rucReceptor: buyerRuc,
                        nombreReceptor: buyerName,
                        fechaEmision: generatedAccessKey ? `${generatedAccessKey.substring(4, 8)}-${generatedAccessKey.substring(2, 4)}-${generatedAccessKey.substring(0, 2)}` : new Date().toISOString().split('T')[0],
                        total: docType === 'factura' ? invoiceTotals.total : withholdingTotal,
                        estado: 'Autorizado',
                        xml: generatedXml,
                        ambiente
                      };
                      printRideDocument(currentComp);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-primary hover:bg-gradient-azure text-white rounded-xl text-[10px] font-black uppercase tracking-wider font-premium transition-all active:scale-[0.98]"
                  >
                    <FileText size={12} />
                    Ver RIDE
                  </button>
                  <button
                    onClick={() => {
                      const currentComp: HistoricComprobante = {
                        id: Date.now().toString(),
                        tipo: docType,
                        secuencial: generatedAccessKey ? generatedAccessKey.substring(30, 39) : '000000001',
                        claveAcceso: generatedAccessKey,
                        rucReceptor: buyerRuc,
                        nombreReceptor: buyerName,
                        fechaEmision: generatedAccessKey ? `${generatedAccessKey.substring(4, 8)}-${generatedAccessKey.substring(2, 4)}-${generatedAccessKey.substring(0, 2)}` : new Date().toISOString().split('T')[0],
                        total: docType === 'factura' ? invoiceTotals.total : withholdingTotal,
                        estado: 'Autorizado',
                        xml: generatedXml,
                        ambiente
                      };
                      downloadXmlFile(currentComp);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider font-premium transition-all active:scale-[0.98]"
                  >
                    <Download size={12} />
                    XML
                  </button>
                  <a
                    href={`https://api.whatsapp.com/send?phone=${
                      (() => {
                        let cleanPhone = buyerPhone.replace(/\D/g, '');
                        if (cleanPhone.startsWith('0')) return '593' + cleanPhone.substring(1);
                        return cleanPhone.length === 9 ? '593' + cleanPhone : cleanPhone;
                      })()
                    }&text=${encodeURIComponent(
                      `Hola *${buyerName}*,\nLe comparto el detalle de su factura emitida en el SRI por Servicios Contables.\n\n` +
                      `*Total:* $${invoiceTotals.total.toFixed(2)}\n` +
                      `*Clave de Acceso:* ${generatedAccessKey}\n\n` +
                      `¡Muchas gracias por su confianza!\n_Santiago Córdova - Soluciones Tributarias_`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-2 flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider font-premium transition-all active:scale-[0.98]"
                  >
                    <Globe size={11} />
                    Enviar por WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <div id="console-terminal-logs" className="glass-card-premium overflow-hidden flex flex-col h-[280px] glass-card-premium relative">
                <div className="px-4 py-2 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
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

                <div className="flex-1 p-4 overflow-y-auto font-mono text-[10px] space-y-1.5 no-scrollbar select-text text-slate-700 dark:text-slate-300">
                  {consoleLogs.length === 0 ? (
                    <div className="text-slate-400 dark:text-slate-600 italic">Esperando inicio de proceso de transmisión...</div>
                  ) : (
                    consoleLogs.map((log, index) => (
                      <div key={index} className="leading-relaxed border-l border-slate-200 dark:border-white/5 pl-2">
                        {log}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}

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

              <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-950 font-mono text-[10px] overflow-auto max-h-[350px] no-scrollbar text-emerald-700 dark:text-emerald-400 select-text border-t border-slate-200 dark:border-0">
                {generatedXml ? (
                  <pre className="whitespace-pre">{generatedXml}</pre>
                ) : (
                  <div className="text-slate-400 dark:text-slate-600 italic flex flex-col justify-center items-center h-full pt-16">
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
              <div className="p-4 bg-slate-50 dark:bg-slate-950 font-mono text-[10px] overflow-auto max-h-[180px] no-scrollbar text-sky-700 dark:text-sky-400 select-text border-t border-slate-200 dark:border-0">
                {generatedJson ? (
                  <pre className="whitespace-pre">{generatedJson}</pre>
                ) : (
                  <div className="text-slate-400 dark:text-slate-600 italic text-center py-6">Estructura del payload JSON.</div>
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
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                            row.estado === 'Autorizado'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : row.estado === 'Error' || row.estado === 'Rechazado'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}>
                            {row.estado}
                          </span>
                          {row.mensajeError && (
                            <span className="text-[8px] text-rose-500 dark:text-rose-400 max-w-[110px] truncate block font-semibold" title={row.mensajeError}>
                              {row.mensajeError}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => printRideDocument(row)}
                            className="p-1 bg-slate-100 hover:bg-primary/20 dark:bg-white/5 dark:hover:bg-primary/20 text-slate-400 hover:text-primary rounded-lg transition-colors"
                            title="Imprimir PDF (RIDE)"
                          >
                            <FileText size={12} />
                          </button>
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
                  className="px-5 py-2.5 bg-primary hover:bg-gradient-azure text-white rounded-xl text-xs font-black uppercase tracking-wider font-premium transition-all"
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
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl font-mono text-[10px] text-slate-700 dark:text-slate-300 space-y-1.5 max-h-[200px] overflow-y-auto no-scrollbar border border-slate-200 dark:border-white/5">
                      {validationResult.details.map((detail, idx) => (
                        <div key={idx} className="border-l border-slate-200 dark:border-white/5 pl-2">{detail}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Sticky Bottom Action Bar for Invoicing */}
      {(activeTab === 'factura' || activeTab === 'retencion') && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/92 dark:bg-slate-900/92 border-t border-slate-200/80 dark:border-white/10 px-4 py-3 shadow-2xl backdrop-blur-md transition-transform duration-300">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex flex-col text-left shrink-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Receptor</span>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                  {activeClientObj ? (
                    <>
                      <User size={11} className="text-primary shrink-0" />
                      <span className="truncate max-w-[160px] text-[11px]">{activeClientObj.name}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 italic text-[11px]">Sin cliente</span>
                  )}
                </div>
              </div>

              <div className="h-8 w-px bg-slate-200 dark:bg-white/10 shrink-0" />

              <div className="flex flex-col text-left">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Ítems</span>
                <span className="text-[11px] font-black font-mono text-slate-700 dark:text-slate-200 mt-0.5">
                  {docType === 'factura' ? invoiceItems.length : withholdings.length} línea{((docType === 'factura' ? invoiceItems.length : withholdings.length) !== 1) ? 's' : ''}
                </span>
              </div>
 
              {activeClientObj && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient('');
                    setClientSearchQuery('');
                    setSelectedPeriods([]);
                    setBuyerName('');
                    setBuyerRuc('');
                    setBuyerEmail('');
                    setBuyerPhone('');
                    setBuyerAddress('');
                  }}
                  className="ml-2 flex items-center gap-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 text-rose-500 dark:text-rose-400 rounded-lg text-[9px] font-black uppercase tracking-wider font-premium hover:bg-rose-100 dark:hover:bg-rose-950/30 transition-colors shrink-0"
                  title="Limpiar y comenzar una nueva factura"
                >
                  <Trash2 size={10} />
                  Reset
                </button>
              )}
            </div>
 
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              <div className="flex flex-col text-right justify-center">
                {(!buyerName.trim() || !buyerRuc.trim()) && !selectedClient && (
                  <span className="text-[8px] text-rose-500 font-black uppercase tracking-wider mb-1 animate-pulse">
                    ⚠️ Falta Comprador (RUC/Nombre)
                  </span>
                )}
                {docType === 'factura' && invoiceItems.length === 0 && (
                  <span className="text-[8px] text-rose-500 font-black uppercase tracking-wider mb-1 animate-pulse">
                    ⚠️ Agregue al menos un Ítem
                  </span>
                )}
                {docType === 'retencion' && withholdings.length === 0 && (
                  <span className="text-[8px] text-rose-500 font-black uppercase tracking-wider mb-1 animate-pulse">
                    ⚠️ Agregue una Retención
                  </span>
                )}
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">Total a Facturar</span>
                <span className="text-lg font-mono font-black text-primary leading-none mt-0.5">
                  ${(docType === 'factura' ? invoiceTotals.total : withholdingTotal).toFixed(2)}
                </span>
              </div>
 
              <button
                type="button"
                onClick={handleProcessDocument}
                disabled={
                  processStatus === 'running' || 
                  (!selectedClient && (!buyerName.trim() || !buyerRuc.trim())) || 
                  (docType === 'factura' ? invoiceItems.length === 0 : withholdings.length === 0)
                }
                className="flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-gradient-azure disabled:bg-slate-100 dark:disabled:bg-white/5 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-xl text-xs font-black uppercase tracking-wider font-premium shadow-primary active:scale-[0.99] transition-all min-w-[190px]"
              >
                {processStatus === 'running' ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Enviando SRI...
                  </>
                ) : (
                  <>
                    <Play size={13} fill="currentColor" />
                    Procesar y Autorizar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Send Suggestion Modal */}
      {/* WhatsApp Send Suggestion Modal */}
      {showWhatsAppModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card-premium rounded-[2.5rem]  p-8 max-w-md w-full space-y-6 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            
            <div className="text-center space-y-3 relative z-10">
              <div className="mx-auto w-12 h-12 bg-emerald-100 dark:bg-emerald-950/30 rounded-full flex items-center justify-center text-emerald-500 mb-2">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-wider text-slate-800 dark:text-white font-premium">
                ¡Comprobante Autorizado!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                El comprobante para <strong className="text-slate-700 dark:text-slate-200">{buyerName}</strong> por un valor total de <strong className="text-primary font-mono">${(docType === 'factura' ? invoiceTotals.total : withholdingTotal).toFixed(2)}</strong> ha sido firmado y autorizado por el SRI.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-4 space-y-2 text-[10px] text-slate-600 dark:text-slate-400 font-medium font-mono leading-relaxed">
              <div><strong className="text-slate-400 font-sans uppercase tracking-wider text-[8px] block">Razón Social:</strong> {buyerName}</div>
              <div><strong className="text-slate-400 font-sans uppercase tracking-wider text-[8px] block">Identificación:</strong> {buyerRuc}</div>
              <div className="truncate"><strong className="text-slate-400 font-sans uppercase tracking-wider text-[8px] block">Clave de Acceso SRI:</strong> {generatedAccessKey}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 relative z-10">
              {/* Button 1: Ver RIDE */}
              <button
                type="button"
                onClick={() => {
                  setShowWhatsAppModal(false);
                  const currentComp: HistoricComprobante = {
                    id: Date.now().toString(),
                    tipo: docType,
                    secuencial: generatedAccessKey ? generatedAccessKey.substring(30, 39) : '000000001',
                    claveAcceso: generatedAccessKey,
                    rucReceptor: buyerRuc,
                    nombreReceptor: buyerName,
                    fechaEmision: generatedAccessKey ? `${generatedAccessKey.substring(4, 8)}-${generatedAccessKey.substring(2, 4)}-${generatedAccessKey.substring(0, 2)}` : new Date().toISOString().split('T')[0],
                    total: docType === 'factura' ? invoiceTotals.total : withholdingTotal,
                    estado: 'Autorizado',
                    xml: generatedXml,
                    ambiente
                  };
                  printRideDocument(currentComp);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-primary hover:bg-gradient-azure text-white rounded-xl text-[10px] font-black uppercase tracking-wider font-premium transition-all active:scale-[0.98]"
              >
                <FileText size={12} />
                Ver RIDE
              </button>

              {/* Button 2: Descargar XML */}
              <button
                type="button"
                onClick={() => {
                  setShowWhatsAppModal(false);
                  const currentComp: HistoricComprobante = {
                    id: Date.now().toString(),
                    tipo: docType,
                    secuencial: generatedAccessKey ? generatedAccessKey.substring(30, 39) : '000000001',
                    claveAcceso: generatedAccessKey,
                    rucReceptor: buyerRuc,
                    nombreReceptor: buyerName,
                    fechaEmision: generatedAccessKey ? `${generatedAccessKey.substring(4, 8)}-${generatedAccessKey.substring(2, 4)}-${generatedAccessKey.substring(0, 2)}` : new Date().toISOString().split('T')[0],
                    total: docType === 'factura' ? invoiceTotals.total : withholdingTotal,
                    estado: 'Autorizado',
                    xml: generatedXml,
                    ambiente
                  };
                  downloadXmlFile(currentComp);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider font-premium transition-all active:scale-[0.98]"
              >
                <Download size={12} />
                Descargar XML
              </button>

              {/* Button 3: WhatsApp */}
              <a
                href={`https://api.whatsapp.com/send?phone=${
                  (() => {
                    let cleanPhone = buyerPhone.replace(/\D/g, '');
                    if (cleanPhone.startsWith('0')) return '593' + cleanPhone.substring(1);
                    return cleanPhone.length === 9 ? '593' + cleanPhone : cleanPhone;
                  })()
                }&text=${encodeURIComponent(
                  `Hola *${buyerName}*,\nLe comparto el detail de su factura emitida en el SRI por Servicios Contables.\n\n` +
                  `*Total:* $${(docType === 'factura' ? invoiceTotals.total : withholdingTotal).toFixed(2)}\n` +
                  `*Clave de Acceso:* ${generatedAccessKey}\n\n` +
                  `¡Muchas gracias por su confianza!\n_Santiago Córdova - Soluciones Tributarias_`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowWhatsAppModal(false)}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider font-premium transition-all active:scale-[0.98]"
              >
                <Globe size={11} />
                WhatsApp
              </a>

              {/* Button 4: Correo */}
              <a
                href={`mailto:${buyerEmail}?subject=${encodeURIComponent(`Comprobante Electrónico SRI Autorizado - ${emisorNombreComercial}`)}&body=${encodeURIComponent(
                  `Estimado/a ${buyerName},\n\n` +
                  `Le informamos que se ha emitido y autorizado su comprobante electrónico en el SRI.\n\n` +
                  `Detalle del Comprobante:\n` +
                  `- Emisor: ${emisorRazonSocial}\n` +
                  `- RUC Emisor: ${emisorRuc}\n` +
                  `- Secuencial: ${generatedAccessKey ? generatedAccessKey.substring(30, 39) : ''}\n` +
                  `- Clave de Acceso: ${generatedAccessKey}\n` +
                  `- Total: $${(docType === 'factura' ? invoiceTotals.total : withholdingTotal).toFixed(2)}\n\n` +
                  `Puede descargar su RIDE o XML desde el portal de facturación o consultar con su clave de acceso en el SRI.\n\n` +
                  `Atentamente,\n` +
                  `${emisorNombreComercial}`
                )}`}
                onClick={() => setShowWhatsAppModal(false)}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider font-premium transition-all active:scale-[0.98]"
              >
                <Mail size={12} />
                Enviar Correo
              </a>

              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="col-span-2 py-3 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-wider font-premium transition-all"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* FULL SCREEN PROCESS LOADING OVERLAY (Cargando / Validando) */}
      {processStatus === 'running' && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full space-y-6 text-center relative overflow-hidden">
            {/* Decorative pulse blur */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl animate-pulse"></div>

            {/* Modern Rotating Spinner */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-primary border-r-indigo-500 rounded-full animate-spin"></div>
              <FileText size={28} className="text-primary animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Transmisión SRI Activa</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Procesando comprobante electrónico...
              </p>
            </div>

            {/* Step Progress indicators */}
            <div className="space-y-3 pt-2 text-left">
              {[
                { step: 1, label: 'Generación de XML' },
                { step: 2, label: 'Firma Digital XAdES-BES' },
                { step: 3, label: 'Recepción y Validación SRI' },
                { step: 4, label: 'Consulta de Autorización' }
              ].map(s => {
                const isActive = currentStep === s.step;
                const isDone = currentStep > s.step;
                return (
                  <div key={s.step} className="flex items-center gap-3 transition-opacity duration-300">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                      isDone 
                        ? 'bg-emerald-500 text-white' 
                        : isActive 
                        ? 'bg-primary text-white animate-pulse' 
                        : 'bg-slate-800 text-slate-500'
                    }`}>
                      {isDone ? <Check size={10} strokeWidth={3} /> : s.step}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                      isDone 
                        ? 'text-emerald-500 font-bold' 
                        : isActive 
                        ? 'text-primary font-bold' 
                        : 'text-slate-500'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ERROR DETAILS DIALOG MODAL */}
      {processErrorMessage && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card-premium rounded-[2.5rem]  p-8 max-w-md w-full space-y-6 relative overflow-hidden text-center">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            
            <div className="mx-auto w-12 h-12 bg-rose-100 dark:bg-rose-950/30 rounded-full flex items-center justify-center text-rose-500 mb-2">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black uppercase tracking-wider text-slate-800 dark:text-white font-premium">
                ⚠️ Error de Transmisión SRI
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">
                El comprobante fue devuelto o rechazado
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-xs font-mono font-bold leading-relaxed text-slate-700 dark:text-slate-300 max-h-[150px] overflow-y-auto no-scrollbar text-left">
              {processErrorMessage}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setProcessErrorMessage(null);
                  const logsEl = document.getElementById('console-terminal-logs');
                  if (logsEl) logsEl.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full py-3 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider font-premium transition-all active:scale-[0.98]"
              >
                Ver Consola
              </button>
              <button
                type="button"
                onClick={() => setProcessErrorMessage(null)}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider font-premium shadow-rose-500/10 transition-all active:scale-[0.98]"
              >
                Cerrar Diálogo
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      </div>
    </div>
  );
};
