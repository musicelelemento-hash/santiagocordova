import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, ClientCategory, DeclarationStatus, Declaration, TaxRegime, Screen, ClientFilter, ServiceFeesConfig, TranscribableField } from '../types';
import { Plus, Search, User, Users, X, Edit, BrainCircuit, Check, DollarSign, RotateCcw, Eye, EyeOff, Copy, ExternalLink, ShieldCheck, Phone, Mail, FileText, Zap, UserCheck, ToggleLeft, ToggleRight, UserX, UserCheck2, MoreHorizontal, Printer, Clipboard, CheckCircle, SlidersHorizontal, MessageCircle, Pin, Send, XCircle, Loader, ArrowDownToLine, ChevronUp, ChevronDown, Sparkles, AlertTriangle, Star, Info, Clock, Mic, Image as ImageIcon } from 'lucide-react';
import { validateIdentifier, getDaysUntilDue, getPeriod, validateSriPassword, formatPeriodForDisplay, getDueDateForPeriod, getNextPeriod, getIdentifierSortKey } from '../services/sri';
import { Modal } from './Modal';
import { v4 as uuidv4 } from 'uuid';
import { summarizeTextWithGemini, analyzeClientPhoto } from '../services/geminiService';
import { format, isPast, subMonths, subYears } from 'date-fns';
import { addAdvancePayments, getClientServiceFee } from '../services/clientService';
import es from 'date-fns/locale/es';
import { useTranscription } from '../hooks/useTranscription';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const declarationStatusColors: { [key in DeclarationStatus]: string } = {
    [DeclarationStatus.Pendiente]: 'bg-gray-400/20 text-gray-500 dark:text-gray-400',
    [DeclarationStatus.Enviada]: 'bg-blue-500/20 text-blue-500',
    [DeclarationStatus.Pagada]: 'bg-green-500/20 text-green-500',
    [DeclarationStatus.Cancelada]: 'bg-red-500/20 text-red-500',
    [DeclarationStatus.Vencida]: 'bg-red-500/20 text-red-600',
};

const IVA_CATEGORIES = [
    ClientCategory.SuscripcionMensual,
    ClientCategory.InternoMensual,
    ClientCategory.SuscripcionSemestral,
    ClientCategory.InternoSemestral,
    ClientCategory.DevolucionIvaTerceraEdad,
];

const newClientInitialState: Partial<Client> = {
  regime: TaxRegime.General,
  category: ClientCategory.SuscripcionMensual,
  declarationHistory: [],
  sriPassword: '',
  ruc: '',
  name: '',
  isActive: true,
  phones: [''],
};

interface ReceiptData {
    transactionId: string;
    clientName: string;
    clientRuc: string;
    client: Client;
    paymentDate: string;
    paidPeriods: { period: string; amount: number }[];
    totalAmount: number;
}

interface ClientsScreenProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  initialFilter: ClientFilter | null;
  navigate: (screen: Screen, options?: { taskFilter: { clientId: string } }) => void;
  serviceFees: ServiceFeesConfig;
  initialClientData: Partial<Client> | null;
  clearInitialClientData: () => void;
  clientToView: Client | null;
  clearClientToView: () => void;
}

const getRecentPeriods = (client: Client, count: number): string[] => {
    const periods: string[] = [];
    let currentDate = new Date();
    for (let i = 0; i < count; i++) {
        const period = getPeriod(client, currentDate);
        if (!periods.includes(period)) {
            periods.push(period);
        }

        if (client.category.includes('Mensual') || client.category === ClientCategory.DevolucionIvaTerceraEdad) {
            currentDate = subMonths(currentDate, 1);
        } else if (client.category.includes('Semestral')) {
            currentDate = subMonths(currentDate, 6);
        } else {
            currentDate = subYears(currentDate, 1);
        }
    }
    while (periods.length < count && client.regime === TaxRegime.RimpeNegocioPopular) {
        const period = getPeriod(client, currentDate);
        if (!periods.includes(period)) {
            periods.push(period);
        }
        currentDate = subYears(currentDate, 1);
    }
    
    return periods.slice(0, count).reverse();
};

const DeclarationProgressBar: React.FC<{ client: Client }> = ({ client }) => {
    const periodsToDisplay = getRecentPeriods(client, 12);
    const historyMap = new Map(client.declarationHistory.map(d => [d.period, d.status]));

    return (
        <div className="flex mt-3 h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            {periodsToDisplay.map(period => {
                const status = historyMap.get(period);
                let colorClass = 'bg-gray-300 dark:bg-gray-600';
                
                if (status === DeclarationStatus.Pagada) colorClass = 'bg-green-500';
                else if (status === DeclarationStatus.Enviada) colorClass = 'bg-blue-500';
                else if (status === DeclarationStatus.Pendiente) {
                    const dueDate = getDueDateForPeriod(client, period);
                    if (dueDate && isPast(dueDate)) {
                        colorClass = 'bg-red-500';
                    } else {
                        colorClass = 'bg-yellow-500';
                    }
                }
                
                const displayPeriod = formatPeriodForDisplay(period);
                
                return (
                    <div key={period} className="h-full flex-1 group relative cursor-pointer">
                        <div className={`h-full w-full ${colorClass}`}></div>
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max p-2 text-xs text-white bg-gray-900 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                           {displayPeriod}: <span className="font-bold">{status || 'No Generado'}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const PaymentHistoryChart: React.FC<{ client: Client }> = ({ client }) => {
    const periods = getRecentPeriods(client, 6);
    const historyMap = new Map(client.declarationHistory.map(d => [d.period, d] as [string, Declaration]));

    const chartData = periods.map(period => {
        const declaration = historyMap.get(period) as Declaration | undefined;
        let status = 'No Generado';
        if (declaration) {
            const dueDate = getDueDateForPeriod(client, period);
            if (declaration.status === DeclarationStatus.Pendiente && dueDate && isPast(dueDate)) {
                status = 'Vencido';
            } else if (declaration.status === DeclarationStatus.Enviada) {
                status = 'Declarado';
            } else if (declaration.status === DeclarationStatus.Pagada) {
                status = 'Pagado';
            } else {
                 status = 'Pendiente';
            }
        }
        return {
            name: formatPeriodForDisplay(period).split(' ')[0],
            value: 1,
            status: status
        };
    });

    const statusColors: { [key: string]: string } = {
        'Pagado': '#22c55e',
        'Declarado': '#3b82f6',
        'Pendiente': '#eab308',
        'Vencido': '#ef4444',
        'No Generado': '#6b7280'
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0];
            const dataPoint = (item as any).payload as { status: string };
            if (dataPoint && dataPoint.status) {
                return (
                    <div className="p-2 bg-gray-900/80 text-white rounded-md border border-gold/50">
                        <p className="label font-bold">{`${label}`}</p>
                        <p className="intro" style={{color: statusColors[dataPoint.status]}}>{`Estado: ${dataPoint.status}`}</p>
                    </div>
                );
            }
        }
        return null;
    };

    return (
        <div className="pt-4">
            <h4 className="text-lg font-bold text-gray-600 dark:text-gray-300 mb-2">Resumen de Últimos 6 Períodos</h4>
            <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                    <RechartsBarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <XAxis dataKey="name" tick={{ fill: 'rgb(156 163 175)', fontSize: 12 }} />
                        <YAxis hide={true} domain={[0, 1]} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212, 175, 55, 0.1)' }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={statusColors[entry.status]} />
                            ))}
                        </Bar>
                    </RechartsBarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};


const DynamicStatusIndicator: React.FC<{ client: Client, declaration: Declaration }> = ({ client, declaration }) => {
    const { status, period, updatedAt, paidAt, declaredAt } = declaration;
    const isMonthly = client.category.includes('Mensual') || client.category === ClientCategory.DevolucionIvaTerceraEdad;
    const isSemestral = client.category.includes('Semestral');
    const frequency = isMonthly ? 'MEN' : (isSemestral ? 'SEM' : '');

    if (status === DeclarationStatus.Pagada || status === DeclarationStatus.Enviada) {
        const statusDate = paidAt ? new Date(paidAt) : (declaredAt ? new Date(declaredAt) : new Date(updatedAt));
        const fullPeriodDisplay = formatPeriodForDisplay(period);
        const currentPeriodDisplay = fullPeriodDisplay.includes('Renta') ? fullPeriodDisplay : `${frequency} ${fullPeriodDisplay.split(' ')[0]}`;
        const nextPeriod = getNextPeriod(period);
        const nextDueDate = getDueDateForPeriod(client, nextPeriod);
        const fullNextPeriodDisplay = formatPeriodForDisplay(nextPeriod);
        const nextPeriodDisplay = fullNextPeriodDisplay.includes('Renta') ? fullNextPeriodDisplay : null;
        const nextFrequency = nextPeriod.includes("-S") ? 'SEM' : (nextPeriod.includes("-") ? 'MEN' : '');

        return (
            <div className="text-xs text-right flex-shrink-0 ml-2">
                <div className="flex items-center justify-end space-x-1 text-green-500 font-bold">
                    <ShieldCheck size={14} />
                    <span>Al día con el SRI</span>
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                    {status === DeclarationStatus.Pagada ? 'Pag.' : 'Decl.'} {currentPeriodDisplay}: {format(statusDate, 'dd MMM/yy', { locale: es })}
                </div>
                {nextDueDate && (
                    <div className="text-gray-500 dark:text-gray-500">
                        Próx. {nextPeriodDisplay || `${nextFrequency} ${formatPeriodForDisplay(nextPeriod).split(' ')[0]}`}: {format(nextDueDate, 'dd MMM/yy', { locale: es })}
                    </div>
                )}
            </div>
        );
    }
    
    const dueDate = getDueDateForPeriod(client, period);
    const daysUntilDue = dueDate ? getDaysUntilDue(dueDate) : null;
    const periodDisplay = formatPeriodForDisplay(period).split(' ')[0];

    if (daysUntilDue !== null && daysUntilDue < 0) {
        return (
            <div className="text-xs text-right text-red-500 font-semibold flex-shrink-0 ml-2">
                <div>Venció hace {Math.abs(daysUntilDue)} {Math.abs(daysUntilDue) === 1 ? 'día' : 'días'}</div>
                <div className="text-red-400/80">{frequency} {periodDisplay} - {dueDate ? format(dueDate, 'dd MMM/yy', { locale: es }) : ''}</div>
            </div>
        );
    } else {
        let countdownText = '';
        let colorClass = 'text-gray-400';
         if (daysUntilDue !== null) {
            if (daysUntilDue > 1) {
                countdownText = `en ${daysUntilDue} días`;
                colorClass = daysUntilDue <= 7 ? 'text-yellow-500' : 'text-gray-400';
            } else if (daysUntilDue === 1) {
                countdownText = 'mañana';
                colorClass = 'text-yellow-500 font-semibold';
            } else if (daysUntilDue === 0) {
                countdownText = 'hoy';
                colorClass = 'text-orange-500 font-bold';
            }
         }

        return (
            <div className="text-xs text-right flex-shrink-0 ml-2">
                <div className="font-semibold text-gray-700 dark:text-gray-300">Pendiente: {periodDisplay}</div>
                {countdownText && <div className={colorClass}>Vence {dueDate ? format(dueDate, 'dd MMM/yy', { locale: es }) : ''} ({countdownText})</div>}
            </div>
        );
    }
};

const ClientDetailView: React.FC<{ client: Client, onSave: (updatedClient: Client) => void, onBack: () => void, serviceFees: ServiceFeesConfig }> = ({ client, onSave, onBack, serviceFees }) => {
    const [editedClient, setEditedClient] = useState(client);
    const [isEditing, setIsEditing] = useState(false);
    const [summary, setSummary] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [confirmation, setConfirmation] = useState<{ action: 'declare' | 'pay'; period: string } | null>(null);
    const [isProcessingAction, setIsProcessingAction] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);
    const receiptRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        setEditedClient(client);
    }, [client]);

    const isProspect = !editedClient.sriPassword || !validateIdentifier(editedClient.ruc).isValid;

    const latestDeclarationForAction = useMemo(() => {
        if (isProspect) return null;
        return [...editedClient.declarationHistory]
          .sort((a, b) => b.period.localeCompare(a.period))
          .find(d => d.status === DeclarationStatus.Pendiente || d.status === DeclarationStatus.Enviada);
      }, [editedClient.declarationHistory, isProspect]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSummarize = async () => {
        if (!editedClient.notes) return;
        setIsSummarizing(true);
        const result = await summarizeTextWithGemini(editedClient.notes);
        setSummary(result);
        setIsSummarizing(false);
    };
    
    const handleRegimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRegime = e.target.value as TaxRegime;
        const newCategory = newRegime === TaxRegime.RimpeNegocioPopular 
            ? ClientCategory.ImpuestoRentaNegocioPopular 
            : ClientCategory.SuscripcionMensual;
        setEditedClient({ ...editedClient, regime: newRegime, category: newCategory });
    };

    const handleSave = () => {
        onSave({...editedClient, phones: (editedClient.phones || []).filter(p => p.trim() !== '')});
        setIsEditing(false);
        setIsMenuOpen(false);
    };
    
    const handleRevertPayment = (periodToRevert: string) => {
        const updatedHistory = editedClient.declarationHistory.map(dec => 
            dec.period === periodToRevert && dec.status === DeclarationStatus.Pagada
                ? { ...dec, status: DeclarationStatus.Enviada, paidAt: undefined, updatedAt: new Date().toISOString() }
                : dec
        );
        onSave({ ...editedClient, declarationHistory: updatedHistory });
    };

    const handleShowReceipt = (declaration: Declaration) => {
        const fee = declaration.amount ?? getClientServiceFee(client, serviceFees);
        const data: ReceiptData = {
            transactionId: declaration.transactionId || `MAN-${declaration.period.replace('-', '')}`,
            clientName: client.name,
            clientRuc: client.ruc,
            client: client,
            paymentDate: format(new Date(declaration.paidAt || declaration.updatedAt), 'dd MMMM yyyy, HH:mm', { locale: es }),
            paidPeriods: [{ period: declaration.period, amount: fee }],
            totalAmount: fee,
        };
        setReceiptData(data);
        setIsReceiptModalOpen(true);
    };

    const handleConfirmAction = (sendWhatsApp: boolean = false) => {
        if (!confirmation) return;
    
        setIsProcessingAction(true);
        const { action, period } = confirmation;
        const now = new Date().toISOString();
        
        const updatedHistory = editedClient.declarationHistory.map(d => {
            if (d.period === period) {
                if (action === 'declare') {
                    return { ...d, status: DeclarationStatus.Enviada, declaredAt: now, updatedAt: now };
                }
                if (action === 'pay') {
                    return { ...d, status: DeclarationStatus.Pagada, paidAt: now, updatedAt: now };
                }
            }
            return d;
        });
    
        const updatedClient = { ...editedClient, declarationHistory: updatedHistory };
        setEditedClient(updatedClient);
        onSave(updatedClient);
    
        setTimeout(() => {
            if (action === 'pay') {
                const updatedDeclaration = updatedHistory.find(d => d.period === period);
                if (updatedDeclaration) handleShowReceipt(updatedDeclaration);
            }
             if (sendWhatsApp && (editedClient.phones || []).length > 0) {
                const mainPhone = editedClient.phones![0];
                const message = `Buen día, le informamos que su declaración del período ${formatPeriodForDisplay(period)} ha sido procesada exitosamente. Saludos, Soluciones Contables Pro.`;
                window.open(`https://wa.me/593${mainPhone.substring(1)}?text=${encodeURIComponent(message)}`, "_blank");
            }
            setIsProcessingAction(false);
            setConfirmation(null);
        }, 500);
    };

    const handlePrintReceipt = () => {
        const receiptEl = receiptRef.current;
        if (receiptEl) {
            const printWindow = window.open('', '_blank', 'height=600,width=800');
            if (printWindow) {
                printWindow.document.write('<html><head><title>Comprobante</title>');
                printWindow.document.write('<style>body { font-family: sans-serif; margin: 20px; color: #111; } table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; } th, td { padding: 10px; border: 1px solid #ccc; text-align: left; } th { background-color: #f2f2f2; } .text-center { text-align: center; } .font-bold { font-weight: bold; } .mb-4 { margin-bottom: 1rem; } .pb-2 { padding-bottom: 0.5rem; } .border-b { border-bottom: 1px solid #ccc; } .text-right { text-align: right; } .mt-4 { margin-top: 1rem; } .pt-2 { padding-top: 0.5rem; } .border-t-2 { border-top: 2px solid #aaa; } </style>');
                printWindow.document.write('</head><body>');
                printWindow.document.write(receiptEl.innerHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            }
        }
    };

    const copyReceiptToClipboard = () => {
        if (receiptData) {
            const text = `
COMPROBANTE DE ABONO / PAGO ADELANTADO
--------------------------------
ID Transacción: ${receiptData.transactionId}
Fecha: ${receiptData.paymentDate}
Cliente: ${receiptData.clientName}
RUC: ${receiptData.clientRuc}
--------------------------------
DETALLE:
${receiptData.paidPeriods.map(p => {
    const dueDate = getDueDateForPeriod(receiptData.client, p.period);
    const dueDateText = dueDate ? ` (Vence: ${format(dueDate, 'dd/MM/yyyy')})` : '';
    return `- ${formatPeriodForDisplay(p.period)}: $${p.amount.toFixed(2)}${dueDateText}`;
}).join('\n')}
--------------------------------
TOTAL PAGADO: $${receiptData.totalAmount.toFixed(2)}
            `.trim();
            navigator.clipboard.writeText(text);
            alert('Comprobante copiado al portapeles.');
        }
    };


    return (
        <div className="p-4 bg-white dark:bg-gray-900 rounded-lg animate-slide-up-fade" style={{opacity: 0}}>
            <div className="flex justify-between items-center mb-4">
                <button onClick={onBack} className="text-gold hover:underline">&larr; Volver a la lista</button>
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <MoreHorizontal size={20} />
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border dark:border-gray-700 animate-fade-in-down">
                           <button onClick={() => { onSave({...editedClient, isActive: !(editedClient.isActive ?? true) }); setIsMenuOpen(false); }} className={`w-full text-left flex items-center space-x-2 px-3 py-2 text-sm rounded-t-md transition-colors ${ (editedClient.isActive ?? true) ? 'text-red-500 hover:bg-red-500/10' : 'text-green-500 hover:bg-green-500/10'}`}>
                                { (editedClient.isActive ?? true) ? <UserX size={16}/> : <UserCheck2 size={16} />}
                                <span>{ (editedClient.isActive ?? true) ? 'Desactivar Cliente' : 'Activar Cliente'}</span>
                            </button>
                            <button onClick={() => { setIsEditing(!isEditing); setIsMenuOpen(false); }} className="w-full text-left flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-md transition-colors">
                                <Edit size={16} />
                                <span>{isEditing ? 'Cancelar Edición' : 'Editar Cliente'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-gold/10 rounded-full"><User className="w-10 h-10 text-gold" /></div>
                <div>
                    <h3 className="text-2xl font-display text-gold">{client.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400">{client.ruc}</p>
                </div>
            </div>

            {isProspect && (
                <div className="p-3 my-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg flex items-center space-x-3 text-sm">
                    <AlertTriangle size={20} />
                    <span>Este es un prospecto. Complete los campos RUC y Clave SRI para activar todas las funciones.</span>
                </div>
            )}
            
            <div className="space-y-4">
                {Object.entries({
                    regime: 'Régimen', category: 'Tipo de declaración', sriPassword: 'Clave SRI', email: 'Email', customServiceFee: 'Tarifa'
                }).map(([key, label]) => (
                     <div key={key}>
                         <label className="text-sm font-bold text-gray-500">{label}</label>
                        {isEditing ? (
                             key === 'regime' ? (
                                <select 
                                    value={editedClient.regime} 
                                    onChange={handleRegimeChange}
                                    className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                                >
                                    {Object.values(TaxRegime).map(val => <option key={val} value={val}>{val}</option>)}
                                </select>
                            ) : key === 'category' ? (
                                editedClient.regime !== TaxRegime.RimpeNegocioPopular &&
                                <select 
                                    value={editedClient.category}
                                    onChange={(e) => setEditedClient({...editedClient, category: e.target.value as ClientCategory})}
                                    className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                                >
                                    {IVA_CATEGORIES.map(val => <option key={val} value={val}>{val}</option>)}
                                </select>
                            ) : (
                                <input 
                                    type={key === 'customServiceFee' ? 'number' : (key === 'sriPassword' ? 'password' : 'text')}
                                    placeholder={key === 'customServiceFee' ? 'Anula las tarifas por defecto' : ''}
                                    value={(editedClient[key as keyof Client] ?? '').toString()} 
                                    onChange={(e) => setEditedClient({...editedClient, [key]: e.target.value})}
                                    className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                                />
                            )
                        ) : (
                            <p className="dark:text-white flex items-center">
                                {key === 'sriPassword' ? '••••••••' : 
                                 key === 'customServiceFee' ? (
                                     `$${getClientServiceFee(editedClient, serviceFees).toFixed(2)} ${editedClient.customServiceFee ? '' : '(predeterminado)'}`
                                 ) : key === 'regime' ? (
                                     (editedClient[key as keyof Client] as string)?.replace('Régimen ', '') ?? 'No establecido'
                                 ) : (
                                     `${editedClient[key as keyof Client] ?? 'No establecido'}`
                                 )
                                }
                            </p>
                        )}
                    </div>
                ))}
                 <div>
                    <label className="text-sm font-bold text-gray-500">Teléfonos</label>
                    {isEditing ? (
                        <div className="space-y-2">
                            {(editedClient.phones || ['']).map((phone, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                   <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => {
                                            const newPhones = [...(editedClient.phones || [])];
                                            newPhones[index] = e.target.value;
                                            setEditedClient(p => ({ ...p, phones: newPhones }));
                                        }}
                                        className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-800 rounded"
                                    />
                                    <button onClick={() => {
                                        const newPhones = (editedClient.phones || []).filter((_, i) => i !== index);
                                        setEditedClient(p => ({ ...p, phones: newPhones }));
                                    }} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={() => setEditedClient(p => ({ ...p, phones: [...(p.phones || []), ''] }))} className="text-sm text-blue-500 hover:underline mt-2">+ Agregar otro teléfono</button>
                        </div>
                    ) : (
                        <div className="mt-1">
                             {(editedClient.phones && editedClient.phones.length > 0) ? 
                                (editedClient.phones.map((p, i) => <p key={i} className="dark:text-white">{p}</p>))
                                : <p className="text-gray-500">No establecido</p>
                            }
                        </div>
                    )}
                </div>
                 <div>
                    <label className="text-sm font-bold text-gray-500">Notas</label>
                    {isEditing ? (
                        <div className="relative">
                            <textarea
                                value={editedClient.notes || ''}
                                onChange={(e) => setEditedClient({ ...editedClient, notes: e.target.value })}
                                rows={4}
                                className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-800 rounded"
                            />
                            <button onClick={handleSummarize} disabled={isSummarizing || !editedClient.notes} className="absolute bottom-2 right-2 p-1.5 bg-gold/20 text-gold rounded-full disabled:opacity-50">
                                {isSummarizing ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            </button>
                        </div>
                    ) : (
                        <p className="dark:text-white whitespace-pre-wrap">{editedClient.notes || 'Sin notas.'}</p>
                    )}
                </div>
                 {summary && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                        <h5 className="font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center"><BrainCircuit size={16} className="mr-2"/> Resumen IA</h5>
                        <p className="text-sm text-blue-700 dark:text-blue-200">{summary}</p>
                    </div>
                )}
            </div>
            {isEditing && (
                <div className="mt-6">
                    <button onClick={handleSave} className="w-full p-3 bg-gold text-black font-bold rounded-lg hover:bg-gold-dark transition-colors">
                        Guardar Cambios
                    </button>
                </div>
            )}
            
            <PaymentHistoryChart client={client} />
            
            <div className="mt-6">
                <h4 className="text-lg font-bold text-gray-600 dark:text-gray-300 mb-4">Historial de Declaraciones</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2 -ml-2 pl-2">
                    <div className="relative pl-8">
                        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                        {[...editedClient.declarationHistory]
                            .sort((a, b) => b.period.localeCompare(a.period))
                            .map((declaration, index, array) => {
                                const dueDate = getDueDateForPeriod(editedClient, declaration.period);
                                const isOverdue = dueDate && isPast(dueDate) && (declaration.status === DeclarationStatus.Pendiente || declaration.status === DeclarationStatus.Enviada);
                                let statusInfo: { text: string; icon: React.ReactNode; color: string; bgColor: string };
                                if (isOverdue) {
                                    statusInfo = { text: 'Vencido', icon: <AlertTriangle size={14} />, color: 'text-red-500', bgColor: 'bg-red-500' };
                                } else {
                                    switch (declaration.status) {
                                        case DeclarationStatus.Pagada: statusInfo = { text: 'Pagada', icon: <CheckCircle size={14} />, color: 'text-green-500', bgColor: 'bg-green-500' }; break;
                                        case DeclarationStatus.Enviada: statusInfo = { text: 'Declarada', icon: <Send size={14} />, color: 'text-blue-500', bgColor: 'bg-blue-500' }; break;
                                        default: statusInfo = { text: 'Pendiente', icon: <Clock size={14} />, color: 'text-yellow-500', bgColor: 'bg-yellow-500' }; break;
                                    }
                                }
                                return (
                                    <div key={declaration.period} className={`relative pb-6 ${index === array.length - 1 ? 'pb-2' : ''}`}>
                                        <div className={`absolute left-0 top-1.5 -translate-x-1/2 w-7 h-7 rounded-full ${statusInfo.bgColor}/20 flex items-center justify-center`}>
                                            <div className={`w-5 h-5 rounded-full ${statusInfo.bgColor} ${statusInfo.color} bg-white dark:bg-gray-900 flex items-center justify-center`}>{statusInfo.icon}</div>
                                        </div>
                                        <div className="ml-2">
                                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-bold dark:text-white">{formatPeriodForDisplay(declaration.period)}</p>
                                                        <p className={`text-sm font-semibold ${statusInfo.color}`}>{statusInfo.text}</p>
                                                    </div>
                                                    <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                                                        {declaration.status === DeclarationStatus.Pagada && declaration.paidAt && <p>Pagado: {format(new Date(declaration.paidAt), 'dd MMM yyyy', { locale: es })}</p>}
                                                        {declaration.status === DeclarationStatus.Enviada && declaration.declaredAt && <p>Declarado: {format(new Date(declaration.declaredAt), 'dd MMM yyyy', { locale: es })}</p>}
                                                        {dueDate && (declaration.status === DeclarationStatus.Pendiente || declaration.status === DeclarationStatus.Enviada) && <p>Vence: {format(dueDate, 'dd MMM yyyy', { locale: es })}</p>}
                                                    </div>
                                                </div>
                                                {(declaration.amount || declaration.status === DeclarationStatus.Pagada) && (<p className="mt-2 text-lg font-bold text-gold">${(declaration.amount ?? getClientServiceFee(editedClient, serviceFees)).toFixed(2)}</p>)}
                                                {declaration.status === DeclarationStatus.Pagada && (
                                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                                                        <button onClick={() => handleRevertPayment(declaration.period)} className="flex-1 flex items-center justify-center space-x-2 px-3 py-1.5 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"><RotateCcw size={14} /><span>Revertir Pago</span></button>
                                                        <button onClick={() => handleShowReceipt(declaration)} className="flex-1 flex items-center justify-center space-x-2 px-3 py-1.5 text-sm rounded-md bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors"><FileText size={14} /><span>Ver Comprobante</span></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <h4 className="text-lg font-bold text-center text-gray-600 dark:text-gray-300 mb-2">
                    Acciones Rápidas
                    {latestDeclarationForAction && ` para ${formatPeriodForDisplay(latestDeclarationForAction.period)}`}
                </h4>
                {isProspect ? (
                    <div className="p-3 my-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg flex items-center space-x-3 text-sm"><Info size={20} /><span>Complete el RUC y la Clave SRI para habilitar las acciones.</span></div>
                ) : latestDeclarationForAction ? (
                    <div className="flex space-x-2">
                        {latestDeclarationForAction.status === DeclarationStatus.Pendiente && (<button onClick={() => setConfirmation({ action: 'declare', period: latestDeclarationForAction.period })} className="w-full p-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"><Send size={16} /><span>Declarar</span></button>)}
                        {latestDeclarationForAction.status === DeclarationStatus.Enviada && (<button onClick={() => setConfirmation({ action: 'pay', period: latestDeclarationForAction.period })} className="w-full p-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"><DollarSign size={16} /><span>Registrar Pago</span></button>)}
                    </div>
                ) : (
                    <div className="p-3 my-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg flex items-center space-x-3 text-sm"><CheckCircle size={20} /><span>¡Cliente al día! No hay acciones pendientes.</span></div>
                )}
            </div>

             {confirmation && (
                <Modal isOpen={!!confirmation} onClose={() => setConfirmation(null)} title="Confirmar Acción">
                    <div className="text-center">
                        <p className="dark:text-gray-300">¿Está seguro de que desea marcar el período <span className="font-bold text-gold">{formatPeriodForDisplay(confirmation.period)}</span> como <span className="font-bold">{confirmation.action === 'declare' ? 'Declarado' : 'Pagado'}</span>?</p>
                        <div className="mt-6 space-y-2">
                            <button onClick={() => handleConfirmAction()} disabled={isProcessingAction} className="w-full p-3 bg-gold text-black font-bold rounded-lg hover:bg-gold-dark disabled:bg-gray-400">{isProcessingAction ? <Loader size={20} className="animate-spin mx-auto"/> : 'Sí, confirmar'}</button>
                            {confirmation.action === 'declare' && (<button onClick={() => handleConfirmAction(true)} disabled={isProcessingAction} className="w-full p-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center space-x-2"><MessageCircle size={18}/><span>Confirmar y Notificar por WhatsApp</span></button>)}
                            <button onClick={() => setConfirmation(null)} className="w-full p-3 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                        </div>
                    </div>
                </Modal>
             )}
              <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Comprobante de Pago">
                 {receiptData && (
                    <div>
                        <div ref={receiptRef} className="p-4 text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-900 rounded-lg">
                           <div className="text-center mb-4">
                              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                              <h3 className="font-display text-xl font-bold">Comprobante de Pago</h3>
                              <p className="text-gray-500 dark:text-gray-400">Soluciones Contables Pro</p>
                           </div>
                           <div className="mb-4 pb-2 border-b border-gray-300 dark:border-gray-600 space-y-1">
                                <p><span className="font-semibold">ID Transacción:</span> {receiptData.transactionId}</p>
                                <p><span className="font-semibold">Fecha de Pago:</span> {receiptData.paymentDate}</p>
                                <p><span className="font-semibold">Cliente:</span> {receiptData.clientName}</p>
                                <p><span className="font-semibold">RUC:</span> {receiptData.clientRuc}</p>
                           </div>
                            <h4 className="font-bold text-lg text-center mb-2">Detalle de Pago</h4>
                             <table className="w-full text-left">
                                 <thead>
                                     <tr className="border-b dark:border-gray-600">
                                         <th className="py-2">Período</th>
                                         <th className="py-2 text-right">Monto</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {receiptData.paidPeriods.map(({ period, amount }) => (<tr key={period} className="border-b dark:border-gray-700"><td className="py-2">{formatPeriodForDisplay(period)}</td><td className="py-2 text-right">${amount.toFixed(2)}</td></tr>))}
                                 </tbody>
                                 <tfoot>
                                    <tr className="font-bold border-t-2 border-gray-300 dark:border-gray-600"><td className="py-2 pt-4 text-right">Total Pagado</td><td className="py-2 pt-4 text-right">${receiptData.totalAmount.toFixed(2)}</td></tr>
                                 </tfoot>
                             </table>
                        </div>
                        <div className="flex space-x-2 mt-4">
                            <button onClick={handlePrintReceipt} className="flex-1 p-2 bg-blue-500 text-white rounded">Imprimir</button>
                            <button onClick={copyReceiptToClipboard} className="flex-1 p-2 bg-gray-500 text-white rounded">Copiar</button>
                        </div>
                    </div>
                 )}
              </Modal>
        </div>
    );
};