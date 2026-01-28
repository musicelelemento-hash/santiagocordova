
export type Screen = 'home' | 'clients' | 'tasks' | 'reports' | 'settings' | 'cobranza' | 'calendar' | 'web_orders' | 'scanner';
export type Theme = 'light' | 'dark' | 'midnight';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
  sources?: { uri: string; title: string }[];
}

export enum DeclarationStatus {
  Pendiente = 'Pendiente',
  Enviada = 'Enviada',
  Pagada = 'Pagada',
  Cancelada = 'Cancelada',
  Vencida = 'Vencida',
}

export enum TaxRegime {
  General = 'Régimen General',
  RimpeNegocioPopular = 'RIMPE Negocio Popular',
  RimpeEmprendedor = 'RIMPE Emprendedor',
}

export enum ClientCategory {
  SuscripcionMensual = 'Suscripción Mensual IVA',
  InternoMensual = 'Interno Mensual',
  SuscripcionSemestral = 'Suscripción Semestral',
  InternoSemestral = 'Interno Semestral',
  ImpuestoRentaNegocioPopular = 'Impuesto a la Renta (Negocio Popular)',
  DevolucionIvaTerceraEdad = 'Devolución IVA 3ra Edad (Mensual)',
}

export enum RentaCategory {
  Suscripcion = 'Suscripción Renta',
  Interno = 'Interno Renta',
}

export interface ServiceBundle {
  id: string;
  title: string;
  price: number;
  description: string;
  features: string[];
  originalPrice?: number; // Para mostrar tachado
}

export interface ServiceFeesConfig {
  ivaMensual: number;
  ivaSemestral: number;
  rentaNP: number;
  rentaGeneral: number;
  devolucionIva: number;
  devolucionRenta: number;
  anexoGastosPersonales: number;
  customPunctualServices?: Array<{ id: string; name: string; price: number }>;
  serviceBundles?: ServiceBundle[];
}

export interface ReminderConfig {
  isEnabled: boolean;
  daysBefore: number;
  onDueDate: boolean;
  overdueInterval: number;
  template: string;
}

export type ReminderType = 'upcoming' | 'due_date' | 'overdue';

export interface Declaration {
  period: string; // e.g., '2024-07', '2024-S1', or '2024'
  status: DeclarationStatus;
  updatedAt: string; // ISO string
  declaredAt?: string; // ISO string for when it was marked 'Enviada'
  paidAt?: string; // ISO string for when it was marked 'Pagada'
  transactionId?: string; // For advance payment receipts
  amount?: number; // Fee paid for this period
  reminders?: Array<{ date: string; channel: 'email' | 'whatsapp', type: ReminderType }>;
}

export interface StoredFile {
    name: string;
    type: string; // 'p12' | 'pdf' | 'other'
    size: number;
    lastModified: number;
    content?: string; // Base64 content (optional to avoid huge DBs)
}

export interface Client {
  id: string;
  ruc: string;
  name: string;
  tradeName?: string;
  sriPassword: string;
  iessPassword?: string;
  phones?: string[];
  email?: string;
  address?: string;
  notes?: string;
  regime: TaxRegime;
  category: ClientCategory;
  rentaCategory?: RentaCategory;
  economicActivity?: string;
  declarationHistory: Declaration[];
  isDeleted?: boolean;
  isActive?: boolean;
  customServiceFee?: number;
  annualRentaStatus?: DeclarationStatus;
  
  // New fields
  isArtisan?: boolean; 
  establishmentCount?: number; 
  jurisdiction?: string; 
  electronicSignaturePassword?: string;
  signatureFile?: StoredFile; 
  rucPdf?: StoredFile;        
  sharedAccessKey?: string;   
  accountingObligated?: boolean;
  signatureExpirationDate?: string;
}

export enum TaskStatus {
  Pendiente = 'Pendiente',
  EnProceso = 'En Proceso',
  Completada = 'Completada',
  Abono = 'Abono',
  Pagada = 'Pagada',
}

export interface Task {
  id: string;
  title: string;
  description: string;
  clientId?: string;
  nonClientName?: string;
  nonClientRuc?: string;
  sriPassword?: string;
  dueDate: string; // ISO string
  status: TaskStatus;
  attachments?: File[];
  cost?: number;
  advancePayment?: number;
}

export type ClientFilter = { 
  category?: ClientCategory; 
  regimes?: TaxRegime[]; 
  title?: string 
};

export type TranscribableField = 'ruc' | 'name' | 'sriPassword' | 'email' | 'phone' | 'notes';

export type AnalysisType = 'cashflow' | 'riskMatrix' | 'optimization' | 'efficiency';

export interface AdvancePaymentResult {
    updatedClient: Client;
    paidPeriods: { period: string; amount: number }[];
    transactionId: string;
    newRentaTask?: Task;
}

export interface ReceiptData {
    transactionId: string;
    clientName: string;
    clientRuc: string;
    client: Client;
    paymentDate: string;
    paidPeriods: { period: string; amount: number }[];
    totalAmount: number;
}

// New Types for Web Orders
export interface OrderItem {
    id: string;
    title: string;
    price: number;
    quantity: number;
}

export interface WebOrder {
    id: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientRuc: string;
    items: OrderItem[];
    total: number;
    status: 'pending' | 'contacted' | 'completed' | 'rejected';
    createdAt: string;
}

export interface PublicUser {
    name: string;
    email: string;
    photoUrl?: string;
}

export interface BusinessProfile {
    ruc: string;
    businessName: string;
    tradeName: string;
    address: string;
    phone: string;
    email: string;
    authNumber: string;
    currentSequence?: number;
}

export interface WhatsAppTemplates {
    paymentReminder: string;
    paymentConfirmation: string;
    declarationNotice: string;
}