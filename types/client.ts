
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

// ClientCategory removed - all logic now relies on Regime and TaxProfile

export enum RentaCategory {
    Suscripcion = 'Suscripción Renta',
    Interno = 'Interno Renta',
}

export enum NoteCategory {
    Important = 'Importante',
    Note = 'Nota',
    Suggestion = 'Sugerencia',
    Key = 'Clave',
    Other = 'Otro',
}

export interface ClientNote {
    id: string;
    content: string;
    category: NoteCategory;
    createdAt: string;
    createdBy?: string;
}

export interface StoredFile {
    name: string;
    type: string; // 'p12' | 'pdf' | 'other'
    size: number;
    lastModified: number;
    content?: string; // Base64 content
    metadata?: {
        amount?: number;
        period?: string;
        formType?: string;
        sriId?: string;
        uploadedAt?: string;
        previewText?: string;
    };
}

export type ReminderType = 'upcoming' | 'due_date' | 'overdue';

export interface Declaration {
    period: string;
    status: DeclarationStatus;
    updatedAt: string;
    declaredAt?: string;
    isPaid?: boolean;
    paidAt?: string;
    transactionId?: string;
    amount?: number;
    reminders?: Array<{ date: string; channel: 'email' | 'whatsapp', type: ReminderType }>;
    proofFile?: StoredFile;
}

export interface ClientFeeStructure {
    monthly?: number;
    semestral?: number;
    annual?: number;
    iceMonthly?: number;
    iceAnexo?: number;
    anexoPvp?: number;
}

export type IvaFrequency = 'Mensual' | 'Semestral' | 'Ninguno';

export interface FinancialItem {
    clientId: string;
    clientName: string;
    ruc: string;
    period: string;
    amount: number;
    status: DeclarationStatus;
    type: 'mensual' | 'semestral' | 'renta' | 'dev';
    dateReference: Date;
    daysDiff?: number;
    phones: string[];
    isVirtual?: boolean;
}

export interface TaxProfile {
    ivaFrequency: IvaFrequency;
    requiresAnnualRenta: boolean;
    requiresAnexosGastos: boolean;
    hasActiveDevolucionIva: boolean;
    hasActiveElderlyDevolucionIva: boolean;
    requiresIce: boolean;
    requiresAnexoPvp: boolean;
}

export interface Client {
    id: string;
    ruc: string;
    name: string;
    tradeName?: string;
    sriPassword: string;
    phones?: string[];
    email?: string;
    address?: string;
    notes?: string;
    regime: TaxRegime;
    isVip?: boolean;
    rentaCategory?: RentaCategory;
    economicActivity?: string;
    declarationHistory: Declaration[];
    isDeleted?: boolean;
    isActive?: boolean;
    taxProfile?: TaxProfile;
    customServiceFee?: number;
    feeStructure?: ClientFeeStructure;
    annualRentaStatus?: DeclarationStatus;
    annualRentaPaid?: boolean;
    annualRentaProof?: StoredFile;
    anexoGastosStatus?: DeclarationStatus;
    anexoGastosPaid?: boolean;
    anexoGastosProof?: StoredFile;
    devolucionIvaStatus?: DeclarationStatus;
    devolucionIvaPaid?: boolean;
    devolucionIvaProof?: StoredFile;
    iceAnexoStatus?: DeclarationStatus;
    iceAnexoPaid?: boolean;
    iceAnexoProof?: StoredFile;
    iceDeclarationStatus?: DeclarationStatus;
    iceDeclarationPaid?: boolean;
    iceDeclarationProof?: StoredFile;
    anexoPvpStatus?: DeclarationStatus;
    anexoPvpPaid?: boolean;
    anexoPvpProof?: StoredFile;
    isArtisan?: boolean;
    establishmentCount?: number;
    jurisdiction?: string;
    electronicSignaturePassword?: string;
    signatureFile?: StoredFile;
    rucPdf?: StoredFile;
    rucCertificate?: StoredFile;
    sharedAccessKey?: string;
    iessPassword?: string;
    signatureExpirationDate?: string;
    vault?: StoredFile[];
    needsVerification?: boolean;
    verificationReason?: string;
    structuredNotes?: ClientNote[];
    hasRentaRefund?: boolean;
    rentaRefundAmount?: number;
    rentaRefundStatus?: 'Pendiente' | 'Solicitado' | 'Esperando Confirmación' | 'Confirmado' | 'Completado' | 'Cancelado';
    rentaRefundRequestedAt?: string;
    rentaRefundConfirmationStartedAt?: string;
    rentaRefundConfirmationDeadline?: string;
    rentaRefundPaid?: boolean;
    rentaRefundProof?: StoredFile;
    rentaRefundResolutionFile?: StoredFile;
    hasElderlyDevolucionIva?: boolean;
    elderlyDevolucionIvaStatus?: 'Pendiente' | 'En Proceso' | 'Completado';
    elderlyDevolucionIvaPaid?: boolean;
    elderlyDevolucionIvaResolutionFile?: StoredFile;
    createdAt?: string;
    updatedAt?: string;
    advanceCredits?: number;
}

export type ClientFilter = {
    regimes?: TaxRegime[];
    ivaFrequency?: IvaFrequency;
    hasActiveDevolucionIva?: boolean;
    hasMissingPdf?: boolean;
    title?: string;
};

export interface SriExtractionResult {
    apellidos_nombres: string;
    ruc: string;
    direccion: string;
    contacto: {
        email: string;
        celular: string;
    };
    regimen: TaxRegime;
    obligaciones_tributarias: string;
    lista_obligaciones: string[];
    actividad_economica: string;
    es_artesano: boolean;
    cantidad_establecimientos: number;
    // New flag indicating if the PDF is a RUC certificate
    isCertificate?: boolean;
}
