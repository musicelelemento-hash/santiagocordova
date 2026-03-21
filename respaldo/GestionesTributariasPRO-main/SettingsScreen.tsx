
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Client, ClientCategory, TaxRegime, ServiceFeesConfig, Screen, Task, DeclarationStatus, Declaration, ReminderConfig } from './types';
import { Trash2, UploadCloud, Download, Info, Edit, Save, XCircle, CheckCircle, Loader, Printer, Clipboard, DollarSign, AlertTriangle, ChevronUp, ChevronDown, Palette, ChevronRight, MessageSquare, ToggleLeft, ToggleRight, CalendarClock } from 'lucide-react';
import { exportClientsToCSV } from './csv';
import { addAdvancePayments, getClientServiceFee } from './clientService';
import { Modal } from './Modal';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { getDueDateForPeriod, formatPeriodForDisplay, getIdentifierSortKey, validateRuc } from './sri';
import { v4 as uuidv4 } from 'uuid';


// Function to parse CSV content. Placed here to be self-contained within the component logic.
const importClientsFromCSV = (
    fileContent: string, 
    existingClients: Client[], 
    setClients: React.Dispatch<React.SetStateAction<Client[]>>
) => {
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
        alert("El archivo CSV está vacío o solo contiene la cabecera.");
        return;
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rucIndex = header.indexOf('ruc');
    
    if (rucIndex === -1) {
        alert("El archivo CSV debe contener una columna 'ruc'.");
        return;
    }

    let updatedCount = 0;
    let createdCount = 0;
    const newClientsList = [...existingClients];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const clientData: { [key: string]: string } = {};
        header.forEach((h, index) => {
            clientData[h] = values[index] || '';
        });

        const ruc = clientData.ruc;
        if (!ruc || ruc.length !== 13) {
            console.warn(`Fila ${i+1} omitida: RUC inválido.`);
            continue;
        }

        const existingClientIndex = newClientsList.findIndex(c => c.ruc === ruc);

        const clientProps: Partial<Client> = {
            name: clientData.nombre || clientData.name,
            sriPassword: clientData.sripassword || clientData.clave, // This can be undefined, will be handled below
            regime: (clientData.régimen || clientData.regime) as TaxRegime || TaxRegime.General,
            category: (clientData.categoría || clientData.category) as ClientCategory || ClientCategory.SuscripcionMensual,
            phones: (clientData.teléfono || clientData.phone || '').split(';').map(p => p.trim()).filter(Boolean),
            email: clientData.email,
            notes: clientData.notas || clientData.notes,
            customServiceFee: clientData.tarifa ? parseFloat(clientData.tarifa) : undefined,
        };
        
        // Basic validation for enums
        if (!Object.values(TaxRegime).includes(clientProps.regime!)) clientProps.regime = TaxRegime.General;
        if (!Object.values(ClientCategory).includes(clientProps.category!)) clientProps.category = ClientCategory.SuscripcionMensual;


        if (existingClientIndex > -1) {
            // Update existing client
            const existingClient = newClientsList[existingClientIndex];
            newClientsList[existingClientIndex] = {
                ...existingClient,
                ...clientProps,
                sriPassword: clientProps.sriPassword !== undefined ? clientProps.sriPassword : existingClient.sriPassword,
            };
            updatedCount++;
        } else {
            // Create new client
            newClientsList.push({
                id: `imported-${Date.now()}-${i}`,
                ruc: ruc,
                declarationHistory: [],
                isActive: true,
                ...clientProps,
                sriPassword: clientProps.sriPassword || '', // Ensure sriPassword is a string
            } as Client);
            createdCount++;
        }
    }

    setClients(newClientsList);
    alert(`Importación completada:\n${createdCount} clientes creados.\n${updatedCount} clientes actualizados.`);
};

interface SettingsScreenProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  serviceFees: ServiceFeesConfig;
  setServiceFees: React.Dispatch<React.SetStateAction<ServiceFeesConfig>>;
  reminderConfig: ReminderConfig;
  setReminderConfig: React.Dispatch<React.SetStateAction<ReminderConfig>>;
  navigate: (screen: Screen, options?: { clientIdToView?: string }) => void;
}

interface ReceiptData {
    transactionId: string;
    clientName: string;
    clientRuc: string;
    client: Client;
    paymentDate: string;
    paidPeriods: { period: string; amount: number }[];
    totalAmount: number;
}

const Tooltip: React.FC<{text: string; children: React.ReactNode}> = ({text, children}) => {
    return (
        <div className="relative flex items-center group">
            {children}
            <div className="absolute left-0 bottom-full mb-2 w-48 p-2 text-xs text-white bg-gray-900 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                {text}
            </div>
        </div>
    )
}

const CollapsibleGuide: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-300">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                <h4 className="font-bold text-gray-800 dark:text-gold flex items-center text-md">
                    <Icon size={18} className="mr-3 text-gold" />
                    <span>{title}</span>
                </h4>
                <ChevronRight className={`w-5 h-5 transition-transform text-gray-500 ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                 <div className="p-4 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                    {children}
                </div>
            </div>
        </div>
    );
};


export const SettingsScreen: React.FC<SettingsScreenProps> = ({ clients, setClients, tasks, setTasks, serviceFees, setServiceFees, reminderConfig, setReminderConfig, navigate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fees, setFees] = useState<ServiceFeesConfig>(serviceFees);
  const [isEditingFees, setIsEditingFees] = useState(false);
  const [localReminderConfig, setLocalReminderConfig] = useState<ReminderConfig>(reminderConfig);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [advancePeriods, setAdvancePeriods] = useState<number>(1);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [securityCode, setSecurityCode] = useState('');
  const [securityCodeError, setSecurityCodeError] = useState('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState<{ id?: string; name: string; price: number } | null>(null);
  const [serviceModalFeedback, setServiceModalFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [includeRentaAdvance, setIncludeRentaAdvance] = useState(false);

  
  useEffect(() => {
      setFees(serviceFees);
  }, [serviceFees]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a,b) => {
        const sortKeyA = getIdentifierSortKey(a.ruc);
        const sortKeyB = getIdentifierSortKey(b.ruc);
        if (sortKeyA !== sortKeyB) {
            return sortKeyA - sortKeyB;
        }
        return a.name.localeCompare(b.name);
    });
  }, [clients]);
  
  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);

  const periodType = useMemo(() => {
    if (!selectedClient) return 'periodos';
    if (selectedClient.category.includes('Semestral')) return 'semestres';
    if (selectedClient.regime === TaxRegime.RimpeNegocioPopular) return 'años';
    return 'meses';
  }, [selectedClient]);

  const { pendingDeclarations, totalDebt } = useMemo(() => {
    if (!selectedClient) return { pendingDeclarations: [], totalDebt: 0 };
    
    const pending: Declaration[] = selectedClient.declarationHistory
      .filter(d => d.status !== DeclarationStatus.Pagada)
      .sort((a, b) => a.period.localeCompare(b.period));
    
    const debt = pending.reduce((sum, d) => {
        const fee = d.amount ?? getClientServiceFee(selectedClient, serviceFees);
        return sum + fee;
    }, 0);

    return { pendingDeclarations: pending, totalDebt: debt };
  }, [selectedClient, serviceFees]);

  const { periodsToCover, advanceAmount, remainingBalance } = useMemo(() => {
    if (!selectedClient || advancePeriods < 0) {
        return { periodsToCover: [], advanceAmount: 0, remainingBalance: totalDebt };
    }
    const periods = pendingDeclarations.slice(0, advancePeriods);
    const amount = periods.reduce((sum, d) => {
        const fee = d.amount ?? getClientServiceFee(selectedClient, serviceFees);
        return sum + fee;
    }, 0);
    
    let rentaFee = 0;
    if (includeRentaAdvance && selectedClient.regime !== TaxRegime.RimpeNegocioPopular) {
        rentaFee = serviceFees.rentaGeneral;
    }

    const totalAmount = amount + rentaFee;
    
    return {
        periodsToCover: periods,
        advanceAmount: totalAmount,
        remainingBalance: totalDebt - amount
    };
  }, [selectedClient, advancePeriods, pendingDeclarations, totalDebt, serviceFees, includeRentaAdvance]);


  const handleExport = () => {
    const activeClients = clients.filter(c => (c.isActive ?? true));
    exportClientsToCSV(activeClients, serviceFees);
  };
  
  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
              const content = e.target?.result as string;
              importClientsFromCSV(content, clients, setClients);
          };
          reader.readAsText(file);
      }
      if(fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleFeeChange = (feeType: keyof ServiceFeesConfig, value: string) => {
      setFees(prev => ({ ...prev, [feeType]: parseFloat(value) || 0 }));
  };

  const handleSaveFees = () => {
    setServiceFees(fees);
    setIsEditingFees(false);
    alert('Tarifas actualizadas correctamente.');
  };
  
  const handleCancelEditFees = () => {
      setFees(serviceFees);
      setIsEditingFees(false);
  }

    const handleSaveReminderConfig = () => {
        setReminderConfig(localReminderConfig);
        alert('Configuración de recordatorios guardada.');
    };

  const handleBulkAdvancePayment = () => {
    if (!selectedClient) return;
    if (advancePeriods < 0) setAdvancePeriods(0);
    if (advancePeriods === 0 && !includeRentaAdvance) {
        alert("Debe ingresar un número de períodos o seleccionar el abono de renta.");
        return;
    }
    setSecurityCode('');
    setSecurityCodeError('');
    setIsSecurityModalOpen(true);
  };

  const handleConfirmAndPay = () => {
    if (securityCode !== '1234') {
        setSecurityCodeError('Código de seguridad incorrecto.');
        return;
    }

    setIsSecurityModalOpen(false);
    setIsProcessing(true);
    
    setTimeout(() => { // Simulate processing
        if (!selectedClient) {
            setIsProcessing(false);
            return;
        }
        const result = addAdvancePayments(selectedClient, advancePeriods, serviceFees, includeRentaAdvance);
        
        setClients(prev => prev.map(c => c.id === result.updatedClient.id ? result.updatedClient : c));
        if (result.newRentaTask) {
            setTasks(prev => [...prev, result.newRentaTask!]);
        }
        
        const totalAmount = result.paidPeriods.reduce((sum, p) => sum + p.amount, 0);

        setReceiptData({
            transactionId: result.transactionId,
            clientName: selectedClient.name,
            clientRuc: selectedClient.ruc,
            client: selectedClient,
            paymentDate: format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: es }),
            paidPeriods: result.paidPeriods,
            totalAmount,
        });

        setIsProcessing(false);
        setIsReceiptModalOpen(true);
        
        // Reset form
        setSelectedClientId('');
        setAdvancePeriods(1);
        setSecurityCode('');
        setIncludeRentaAdvance(false);
    }, 1000); // 1s delay for visual feedback
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

  const feeFields = {
      declarations: [
          { key: 'ivaMensual' as const, label: 'IVA Mensual', tooltip: 'Se aplica a clientes de Régimen General y Emprendedor con declaraciones mensuales.' },
          { key: 'ivaSemestral' as const, label: 'IVA Semestral', tooltip: 'Se aplica a clientes de Régimen General y Emprendedor con declaraciones semestrales.' },
          { key: 'rentaNP' as const, label: 'Renta (Negocio Popular)', tooltip: 'Se aplica a la declaración anual de clientes RIMPE Negocio Popular.' },
          { key: 'rentaGeneral' as const, label: 'Renta (General/Emprendedor)', tooltip: 'Se aplica a la declaración anual de Renta gestionada desde Tareas.' },
          { key: 'devolucionIva' as const, label: 'Devolución IVA 3ra Edad', tooltip: 'Tarifa para el trámite mensual de devolución de IVA para tercera edad.' },
      ],
      tasks: [
          { key: 'devolucionRenta' as const, label: 'Devolución de Renta', tooltip: 'Tarifa para el trámite de devolución de retenciones de impuesto a la renta.' },
          { key: 'anexoGastosPersonales' as const, label: 'Anexo de Gastos Personales', tooltip: 'Tarifa para la preparación y presentación del anexo de gastos personales.' },
      ]
  }
  
  const handleAddService = () => {
    setCurrentService({ name: '', price: 0 });
    setServiceModalFeedback(null);
    setIsServiceModalOpen(true);
  };
  
  const handleEditService = (service: { id: string; name: string; price: number }) => {
    setCurrentService(service);
    setServiceModalFeedback(null);
    setIsServiceModalOpen(true);
  };

  const handleSaveService = () => {
    if (!currentService || !currentService.name.trim() || currentService.price === undefined || currentService.price < 0) {
        setServiceModalFeedback({ message: "El nombre es requerido y el precio no puede ser negativo.", type: 'error' });
        return;
    }
    setFees(prev => {
        const customServices = [...(prev.customPunctualServices || [])];
        if (currentService.id) {
            const index = customServices.findIndex(s => s.id === currentService.id);
            if (index > -1) {
                customServices[index] = { ...currentService, price: currentService.price ?? 0 } as {id: string; name: string; price: number};
            }
        } else {
            customServices.push({ ...currentService, price: currentService.price ?? 0, id: uuidv4() } as {id: string; name: string; price: number});
        }
        return { ...prev, customPunctualServices: customServices };
    });
    
    setServiceModalFeedback({ message: '¡Servicio guardado exitosamente!', type: 'success' });

    setTimeout(() => {
        setIsServiceModalOpen(false);
        setCurrentService(null);
    }, 1500);
  };

  const handleDeleteService = (serviceId: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar este servicio? Esta acción no se puede deshacer.")) {
        setFees(prev => ({
            ...prev,
            customPunctualServices: (prev.customPunctualServices || []).filter(s => s.id !== serviceId)
        }));
    }
  };

  return (
    <div className="relative">
      <h2 className="text-4xl font-display font-bold text-gold mb-8">Ajustes y Extras</h2>
      
      <div className="space-y-6">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-xl dark:text-white">Configuración de Tarifas</h3>
                {!isEditingFees && (
                     <button onClick={() => setIsEditingFees(true)} className="flex items-center space-x-2 px-3 py-1 text-sm rounded-md bg-gold/10 text-gold hover:bg-gold/20">
                         <Edit size={14}/>
                         <span>Editar</span>
                     </button>
                )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                Establezca los precios base para cada servicio. Se usarán en los reportes a menos que un cliente tenga una tarifa personalizada.
            </p>
            
            <div className="space-y-4">
                <div>
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Declaraciones Periódicas</h4>
                    <div className="space-y-3 pl-2 border-l-2 border-gold">
                         {feeFields.declarations.map(item => (
                            <div key={item.key} className="flex items-center space-x-2">
                                <label className="w-1/2 dark:text-gray-300 flex items-center text-sm">
                                    {item.label}
                                    <Tooltip text={item.tooltip}>
                                        <Info size={14} className="ml-2 text-gray-400"/>
                                    </Tooltip>
                                </label>
                                <div className="relative flex-1">
                                    <DollarSign size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="number"
                                        readOnly={!isEditingFees}
                                        value={fees[item.key]}
                                        onChange={(e) => handleFeeChange(item.key, e.target.value)}
                                        className={`w-full p-2 pl-8 rounded ${isEditingFees ? 'bg-gray-100 dark:bg-gray-700' : 'bg-gray-200 dark:bg-gray-800 cursor-not-allowed'}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                     <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Servicios y Tareas Puntuales</h4>
                     <div className="space-y-3 pl-2 border-l-2 border-gold">
                        {feeFields.tasks.map(item => (
                            <div key={item.key} className="flex items-center space-x-2">
                                <label className="w-1/2 dark:text-gray-300 flex items-center text-sm">
                                    {item.label}
                                     <Tooltip text={item.tooltip}>
                                        <Info size={14} className="ml-2 text-gray-400"/>
                                    </Tooltip>
                                </label>
                                <div className="relative flex-1">
                                    <DollarSign size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="number"
                                        readOnly={!isEditingFees}
                                        value={fees[item.key]}
                                        onChange={(e) => handleFeeChange(item.key, e.target.value)}
                                        className={`w-full p-2 pl-8 rounded ${isEditingFees ? 'bg-gray-100 dark:bg-gray-700' : 'bg-gray-200 dark:bg-gray-800 cursor-not-allowed'}`}
                                    />
                                </div>
                            </div>
                        ))}
                        {(fees.customPunctualServices || []).map(service => (
                            <div key={service.id} className="flex items-center space-x-2">
                                <label className="w-1/2 dark:text-gray-300 flex items-center text-sm">
                                    {isEditingFees ? (
                                        <input 
                                            type="text" 
                                            value={service.name} 
                                            readOnly 
                                            className="w-full p-2 bg-gray-200 dark:bg-gray-800 rounded cursor-not-allowed"
                                        />
                                    ) : (
                                        service.name
                                    )}
                                </label>
                                <div className="relative flex-1">
                                    <DollarSign size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="number"
                                        readOnly
                                        value={service.price}
                                        className="w-full p-2 pl-8 rounded bg-gray-200 dark:bg-gray-800 cursor-not-allowed"
                                    />
                                </div>
                                {isEditingFees && (
                                    <div className="flex items-center space-x-1">
                                        <button onClick={() => handleEditService(service)} className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full transition-colors"><Edit size={16}/></button>
                                        <button onClick={() => handleDeleteService(service.id)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                )}
                            </div>
                        ))}
                     </div>
                     {isEditingFees && (
                        <div className="pt-4 pl-2">
                            <button onClick={handleAddService} className="w-full text-left p-2 text-sm text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors flex items-center justify-center space-x-2">
                                <span>+ Agregar Servicio Puntual</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isEditingFees && (
                <div className="flex space-x-4 mt-6">
                    <button onClick={handleSaveFees} className="w-full p-3 bg-gold text-black font-bold rounded-lg hover:bg-gold-dark flex items-center justify-center space-x-2">
                        <CheckCircle size={18}/>
                        <span>Guardar Tarifas</span>
                    </button>
                    <button onClick={handleCancelEditFees} className="w-full p-3 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center space-x-2">
                         <XCircle size={18}/>
                         <span>Cancelar</span>
                    </button>
                </div>
            )}
        </div>
        
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
             <CollapsibleGuide title="Recordatorios de Pago Automáticos" icon={CalendarClock}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label htmlFor="enable_reminders" className="font-semibold text-gray-700 dark:text-gray-300">Activar Recordatorios</label>
                        <button onClick={() => setLocalReminderConfig(c => ({...c, isEnabled: !c.isEnabled}))}>
                            {localReminderConfig.isEnabled ? <ToggleRight size={24} className="text-gold"/> : <ToggleLeft size={24} className="text-gray-400"/>}
                        </button>
                    </div>
                    
                    <div className={!localReminderConfig.isEnabled ? 'opacity-50 pointer-events-none' : ''}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Recordar X días antes de vencer</label>
                                <input 
                                    type="number" 
                                    value={localReminderConfig.daysBefore}
                                    onChange={e => setLocalReminderConfig(c => ({...c, daysBefore: parseInt(e.target.value) || 0}))}
                                    className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Recordar cada X días (vencido)</label>
                                <input 
                                    type="number"
                                    value={localReminderConfig.overdueInterval}
                                    onChange={e => setLocalReminderConfig(c => ({...c, overdueInterval: parseInt(e.target.value) || 0}))}
                                    className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={localReminderConfig.onDueDate}
                                    onChange={e => setLocalReminderConfig(c => ({...c, onDueDate: e.target.checked}))}
                                    className="form-checkbox h-4 w-4 text-gold bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-gold"
                                />
                                <span className="text-sm">Recordar el día del vencimiento</span>
                            </label>
                        </div>
                        <div className="mt-4">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Plantilla del Mensaje</label>
                            <p className="text-xs text-gray-400 mb-1">Variables: <code className="text-xs">{`{clientName}, {period}, {amount}, {dueDate}`}</code></p>
                            <textarea
                                rows={6}
                                value={localReminderConfig.template}
                                onChange={e => setLocalReminderConfig(c => ({...c, template: e.target.value}))}
                                className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono"
                            />
                        </div>
                    </div>
                    
                    <button onClick={handleSaveReminderConfig} className="w-full mt-2 p-3 bg-gold text-black font-bold rounded-lg hover:bg-gold-dark flex items-center justify-center space-x-2">
                        <Save size={18}/>
                        <span>Guardar Configuración de Recordatorios</span>
                    </button>
                </div>
            </CollapsibleGuide>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h3 className="font-bold text-xl mb-2 dark:text-white">Abonos / Pagos Adelantados</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                Registre pagos por adelantado para un cliente. El sistema aplicará los periodos correspondientes (meses, semestres o años) según el régimen del cliente.
            </p>
            <div className="space-y-3">
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
                    <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"
                    >
                        <option value="">Seleccione un cliente...</option>
                        {sortedClients.filter(c => (c.isActive ?? true) && !(!c.sriPassword || !validateRuc(c.ruc).isValid)).map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                    </select>
                </div>

                {selectedClient && (
                    <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600 space-y-4 animate-fade-in-down">
                        <div>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300">Estado de Cuenta</h4>
                            {totalDebt > 0 ? (
                                <div className="mt-2 space-y-1 text-sm bg-gray-50 dark:bg-gray-900/50 p-3 rounded-md">
                                    <p className="font-bold text-lg mb-2 text-red-500">Deuda Total: ${totalDebt.toFixed(2)}</p>
                                    <div className="max-h-24 overflow-y-auto pr-2">
                                    {pendingDeclarations.map(d => {
                                        const dueDate = getDueDateForPeriod(selectedClient, d.period);
                                        const isOverdue = dueDate && isPast(dueDate);
                                        return (
                                            <div key={d.period} className={`flex justify-between items-center ${isOverdue ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                                                <span>{formatPeriodForDisplay(d.period)}</span>
                                                <span className="font-mono">${getClientServiceFee(selectedClient, serviceFees).toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded-md text-sm">
                                    <p className="font-bold text-green-800 dark:text-green-300 flex items-center">
                                        <CheckCircle className="inline-block mr-2" size={18}/>
                                        El cliente está al día. No tiene deudas pendientes.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Número de {periodType} a abonar
                            </label>
                            <input 
                                type="number" 
                                value={advancePeriods}
                                onChange={(e) => setAdvancePeriods(parseInt(e.target.value, 10) || 0)}
                                min="0"
                                className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"
                                disabled={!selectedClientId}
                            />
                        </div>

                         {selectedClient.regime !== TaxRegime.RimpeNegocioPopular && (
                            <label className="flex items-center space-x-2 pt-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={includeRentaAdvance}
                                    onChange={(e) => setIncludeRentaAdvance(e.target.checked)}
                                    className="form-checkbox h-5 w-5 text-gold bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-gold"
                                />
                                <span>Incluir Abono Renta Anticipada</span>
                            </label>
                        )}

                        {(advancePeriods > 0 || includeRentaAdvance) && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm">
                                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Resumen del Abono</h4>
                                <div className="space-y-1">
                                    {periodsToCover.length > 0 && (
                                        <p>Se cubrirán <strong>{periodsToCover.length}</strong> {periodsToCover.length === 1 ? periodType.slice(0, -1) : periodType}: <span className="text-xs">({periodsToCover.map(p => formatPeriodForDisplay(p.period).split(' ')[0]).join(', ')})</span></p>
                                    )}
                                    {includeRentaAdvance && <p>+ Abono de Renta Anual</p>}
                                    <p>Monto del Abono: <strong className="text-lg text-green-600 dark:text-green-400">${advanceAmount.toFixed(2)}</strong></p>
                                    <p>Saldo Restante: <strong className="text-lg text-red-600 dark:text-red-400">${remainingBalance.toFixed(2)}</strong></p>
                                </div>
                            </div>
                        )}
                        
                    </div>
                )}
            </div>
            <button 
                onClick={handleBulkAdvancePayment} 
                disabled={!selectedClientId || isProcessing || (advancePeriods <= 0 && !includeRentaAdvance)}
                className="w-full mt-6 p-3 bg-gold text-black font-bold rounded-lg hover:bg-gold-dark disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
                {isProcessing ? <><Loader className="animate-spin mr-2"/> Procesando...</> : 'Registrar Abono'}
            </button>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h3 className="font-bold text-xl mb-4 dark:text-white">Gestión de Datos y Guías</h3>
             <div className="space-y-4">
                <CollapsibleGuide title="Leyenda de Estados y Colores" icon={Palette}>
                    <div className="space-y-3">
                        <div>
                            <p className="font-semibold mb-1 dark:text-gray-200">Color del Borde Izquierdo:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li className="flex items-center space-x-2"><div className="w-4 h-4 border-l-4 border-red-500 rounded-sm flex-shrink-0"></div><span><strong className="text-red-500">Rojo:</strong> Cliente con declaración vencida.</span></li>
                                <li className="flex items-center space-x-2"><div className="w-4 h-4 border-l-4 border-yellow-500 rounded-sm flex-shrink-0"></div><span><strong className="text-yellow-500">Amarillo:</strong> Cliente con declaración pendiente por vencer.</span></li>
                                <li className="flex items-center space-x-2"><div className="w-4 h-4 border-l-4 border-gray-400 dark:border-gray-600 rounded-sm flex-shrink-0"></div><span><strong className="text-gray-500">Gris:</strong> Cliente al día, sin acciones pendientes.</span></li>
                            </ul>
                        </div>
                         <div>
                            <p className="font-semibold mb-1 dark:text-gray-200">Color de Fondo del Cliente:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li className="flex items-center space-x-2"><div className="w-4 h-4 bg-gold/5 rounded-sm flex-shrink-0"></div><span><strong className="text-gold">Dorado Tenue:</strong> Cliente con Suscripción.</span></li>
                                <li className="flex items-center space-x-2"><div className="w-4 h-4 bg-blue-500/10 rounded-sm flex-shrink-0"></div><span><strong className="text-blue-400">Azul Tenue:</strong> Cliente de tipo "Interno".</span></li>
                            </ul>
                        </div>
                    </div>
                </CollapsibleGuide>
                 <CollapsibleGuide title="Guía Rápida de Importación CSV" icon={Info}>
                    <p>
                        Importe clientes usando un archivo CSV. El <strong>RUC</strong> es la clave para actualizar clientes existentes o crear nuevos.
                    </p>
                    <p className="mt-2">
                        <strong>Columnas recomendadas:</strong> <code>ruc, nombre, clave, regimen, categoria, telefono, email, notas, tarifa</code>
                    </p>
                </CollapsibleGuide>
            </div>
            <div className="flex space-x-4 mt-6">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                />
                <button onClick={handleImportClick} className="flex-1 flex items-center justify-center space-x-2 p-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors">
                    <UploadCloud size={20} />
                    <span>Importar CSV</span>
                </button>
                <button onClick={handleExport} className="flex-1 flex items-center justify-center space-x-2 p-3 bg-gold text-black font-bold rounded-lg hover:bg-gold-dark transition-colors">
                    <Download size={20} />
                    <span>Exportar CSV</span>
                </button>
            </div>
        </div>
      </div>

      <Modal isOpen={isSecurityModalOpen} onClose={() => setIsSecurityModalOpen(false)} title="Confirmación de Seguridad">
        <div className="space-y-4">
          <p className="dark:text-gray-300">Para confirmar el pago para <span className="font-bold text-gold">{selectedClient?.name}</span>, por favor ingrese el código de seguridad.</p>
          <input 
            type="password"
            placeholder="Código de seguridad (1234)"
            value={securityCode}
            onChange={(e) => { setSecurityCode(e.target.value); setSecurityCodeError(''); }}
            className={`w-full p-2 bg-gray-100 dark:bg-gray-700 rounded ${securityCodeError ? 'border-red-500' : ''}`}
          />
          {securityCodeError && <p className="text-red-500 text-sm">{securityCodeError}</p>}
          <button onClick={handleConfirmAndPay} className="w-full mt-4 p-3 bg-gold text-black font-bold rounded-lg hover:bg-gold-dark">
            <CheckCircle className="inline mr-2"/>
            Confirmar y Pagar
          </button>
        </div>
      </Modal>

      <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Comprobante de Abono / Pago Adelantado">
        {receiptData && (
            <div>
                 <div ref={receiptRef} className="p-4 text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-900 rounded-lg">
                     <div className="text-center mb-4">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <h3 className="font-display text-xl font-bold">Comprobante de Abono / Pago Adelantado</h3>
                        <p className="text-gray-500 dark:text-gray-400">Soluciones Contables Pro</p>
                     </div>

                     <div className="mb-4 pb-2 border-b border-gray-300 dark:border-gray-600 space-y-1">
                        <p><span className="font-semibold">ID Transacción:</span> {receiptData.transactionId}</p>
                        <p><span className="font-semibold">Fecha de Pago:</span> {receiptData.paymentDate}</p>
                        <p><span className="font-semibold">Cliente:</span> {receiptData.clientName}</p>
                        <p><span className="font-semibold">RUC:</span> {receiptData.clientRuc}</p>
                     </div>

                     <h4 className="font-bold text-lg text-center mb-2">Detalle de Pagos</h4>
                     <table className="w-full text-left">
                         <thead>
                             <tr className="border-b dark:border-gray-600">
                                 <th className="py-2">Período</th>
                                 <th className="py-2">Fecha Límite</th>
                                 <th className="py-2 text-right">Monto</th>
                             </tr>
                         </thead>
                         <tbody>
                             {receiptData.paidPeriods.map(({ period, amount }) => {
                                const dueDate = getDueDateForPeriod(receiptData.client, period);
                                return (
                                    <tr key={period} className="border-b dark:border-gray-700">
                                        <td className="py-2">{formatPeriodForDisplay(period)}</td>
                                        <td className="py-2">{dueDate ? `Hasta ${format(dueDate, 'd MMM yyyy', { locale: es })}` : 'N/A'}</td>
                                        <td className="py-2 text-right">${amount.toFixed(2)}</td>
                                    </tr>
                                );
                             })}
                         </tbody>
                         <tfoot>
                            <tr className="font-bold">
                                <td colSpan={2} className="py-2 pt-4 text-right">Total Pagado</td>
                                <td className="py-2 pt-4 text-right">${receiptData.totalAmount.toFixed(2)}</td>
                            </tr>
                         </tfoot>
                     </table>
                 </div>
                 <div className="flex space-x-4 mt-6">
                     <button onClick={handlePrintReceipt} className="w-full p-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 flex items-center justify-center space-x-2">
                        <Printer size={18}/>
                        <span>Imprimir</span>
                     </button>
                      <button onClick={copyReceiptToClipboard} className="w-full p-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 flex items-center justify-center space-x-2">
                         <Clipboard size={18}/>
                         <span>Copiar</span>
                     </button>
                 </div>
            </div>
        )}
      </Modal>

        <Modal 
            isOpen={isServiceModalOpen} 
            onClose={() => {
                if(serviceModalFeedback?.type === 'success') return;
                setIsServiceModalOpen(false)
            }} 
            title={currentService?.id ? "Editar Servicio" : "Nuevo Servicio Puntual"}
        >
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre del Servicio</label>
                    <input 
                        type="text"
                        placeholder="Ej: Anexo de Accionistas"
                        value={currentService?.name || ''}
                        onChange={(e) => setCurrentService(prev => prev ? {...prev, name: e.target.value} : null)}
                        className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Precio</label>
                    <div className="relative">
                        <input
                            type="number"
                            placeholder="20.00"
                            value={currentService?.price ?? ''}
                            onChange={(e) => setCurrentService(prev => prev ? {...prev, price: parseFloat(e.target.value) || 0} : null)}
                            className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center">
                            <button type="button" onClick={() => setCurrentService(prev => prev ? {...prev, price: (prev.price ?? 0) + 1} : null)} className="h-4 flex items-center justify-center text-gray-500 hover:text-gold transition-colors"><ChevronUp size={16}/></button>
                            <button type="button" onClick={() => setCurrentService(prev => prev ? {...prev, price: Math.max(0, (prev.price ?? 0) - 1)} : null)} className="h-4 flex items-center justify-center text-gray-500 hover:text-gold transition-colors"><ChevronDown size={16}/></button>
                        </div>
                    </div>
                </div>
                {serviceModalFeedback && (
                    <div className={`p-3 text-center text-sm rounded-lg animate-fade-in-down ${serviceModalFeedback.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                        {serviceModalFeedback.message}
                    </div>
                )}
                <button onClick={handleSaveService} className="w-full mt-2 p-3 bg-gold text-black font-bold rounded-lg hover:bg-gold-dark transition-colors">
                    Guardar Servicio
                </button>
            </div>
        </Modal>

    </div>
  );
};
