import { Client } from './client';

export interface ReceiptData {
    transactionId: string;
    clientName: string;
    clientRuc: string;
    client: Client;
    paymentDate: string;
    paidPeriods: Array<{ period: string, amount: number }>;
    totalAmount: number;
}

export interface ServiceFeesConfig {
    ivaMensual: number;
    ivaSemestral: number;
    rentaNP: number;
    rentaGeneral: number;
    devolucionIva: number;
    devolucionRenta: number;
    anexoGastosPersonales: number;
    rentaButtonsStartMonth?: number;
    customPunctualServices?: Array<{ id: string; name: string; price: number }>;
    serviceBundles?: Array<{
        id: string;
        title: string;
        description: string;
        price: number;
        originalPrice?: number;
        features: string[];
    }>;
}

export interface ReminderConfig {
    isEnabled: boolean;
    daysBefore: number;
    onDueDate: boolean;
    overdueInterval: number;
    template: string;
}

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

export interface BusinessProfile {
    ruc: string;
    businessName: string;
    tradeName: string;
    address: string;
    phone: string;
    email: string;
    authNumber?: string;
    currentSequence?: number;
}
