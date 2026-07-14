import { z } from 'zod';
import { DeclarationStatus, TaxRegime, RentaCategory } from '../../types';

export const StoredFileSchema = z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    lastModified: z.number(),
    content: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
});

export const ClientNoteSchema = z.object({
    id: z.string(),
    content: z.string(),
    category: z.enum(['Importante', 'Nota', 'Sugerencia', 'Clave', 'Otro']),
    createdAt: z.string(),
    createdBy: z.string().optional(),
});

export const DeclarationSchema = z.object({
    period: z.string(),
    status: z.nativeEnum(DeclarationStatus),
    updatedAt: z.string(),
    declaredAt: z.string().optional(),
    is_paid: z.boolean().optional(),
    paidAt: z.string().optional(),
    transactionId: z.string().optional(),
    amount: z.number().optional(),
    reminders: z.array(z.object({
        date: z.string(),
        channel: z.enum(['email', 'whatsapp']),
        type: z.enum(['upcoming', 'due_date', 'overdue'])
    })).optional(),
    proof_file: StoredFileSchema.optional(),
});

export const ClientFeeStructureSchema = z.object({
    monthly: z.number().optional(),
    semestral: z.number().optional(),
    annual: z.number().optional(),
    iceMonthly: z.number().optional(),
    iceAnexo: z.number().optional(),
    anexoPvp: z.number().optional(),
});

export const TaxProfileSchema = z.object({
    ivaFrequency: z.enum(['Mensual', 'Semestral', 'Ninguno']),
    requiresAnnualRenta: z.boolean(),
    requiresAnexosGastos: z.boolean(),
    hasActiveDevolucionIva: z.boolean(),
    hasActiveElderlyDevolucionIva: z.boolean().optional(),
    requiresIce: z.boolean(),
    requiresAnexoPvp: z.boolean(),
});

export const ClientSchema = z.object({
    id: z.string(),
    ruc: z.string().min(10).max(13),
    name: z.string().min(3),
    tradeName: z.string().optional(),
    sriPassword: z.string().min(1),
    phones: z.array(z.string()).optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    notes: z.string().optional(),
    regime: z.nativeEnum(TaxRegime),
    rentaCategory: z.nativeEnum(RentaCategory).optional(),
    economicActivity: z.string().optional(),
    declarations: z.array(DeclarationSchema),
    isDeleted: z.boolean().optional(),
    isActive: z.boolean().optional(),
    taxProfile: TaxProfileSchema.optional(),
    customServiceFee: z.number().optional(),
    fee_structure: ClientFeeStructureSchema.optional(),
    isArtisan: z.boolean().optional(),
    establishmentCount: z.number().optional(),
    jurisdiction: z.string().optional(),
    electronicSignaturePassword: z.string().optional(),
    signatureFile: StoredFileSchema.optional(),
    rucPdf: StoredFileSchema.optional(),
    sharedAccessKey: z.string().optional(),
    iessPassword: z.string().optional(),
    signatureExpirationDate: z.string().optional(),
    vault: z.array(StoredFileSchema).optional(),
    needsVerification: z.boolean().optional(),
    verificationReason: z.string().optional(),
    structuredNotes: z.array(ClientNoteSchema).optional(),
    hasRentaRefund: z.boolean().optional(),
    rentaRefundAmount: z.number().optional(),
    rentaRefundStatus: z.enum(['Pendiente', 'Solicitado', 'Esperando Confirmación', 'Confirmado', 'Completado', 'Cancelado']).optional(),
    rentaRefundRequestedAt: z.string().optional(),
    rentaRefundPaid: z.boolean().optional(),
    rentaRefundProof: StoredFileSchema.optional(),
    hasElderlyDevolucionIva: z.boolean().optional(),
    elderlyDevolucionIvaStatus: z.enum(['Pendiente', 'En Proceso', 'Completado']).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    advanceCredits: z.number().optional(),
    clientStartPeriod: z.string().optional(),
    facturadorConfig: z.object({
        programName: z.string().optional(),
        url: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        expirationDate: z.string().optional(),
        documentStatus: z.string().optional(),
        documentCount: z.number().optional(),
        price: z.number().optional(),
    }).optional(),
});

export type ValidatedClient = z.infer<typeof ClientSchema>;
