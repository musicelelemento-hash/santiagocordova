
export type Screen = 'home' | 'clients' | 'tasks' | 'reports' | 'settings' | 'cobranza' | 'calendar' | 'web_orders' | 'scanner' | 'audit_log' | 'sri_facturacion' | 'migracion_zifact';
export type Theme = 'light' | 'dark';

export interface AuditLog {
    id: string;
    timestamp: string;
    action: string;
    details: string;
    type: 'client' | 'task' | 'finance' | 'system' | 'ai';
    severity: 'info' | 'warning' | 'critical';
}

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

export interface PublicUser {
    name: string;
    email: string;
    photoUrl?: string;
}

export type TranscribableField = 'ruc' | 'name' | 'sriPassword' | 'email' | 'phone' | 'notes';
export enum AnalysisType {
    Cashflow = 'cashflow',
    RiskMatrix = 'riskMatrix',
    Optimization = 'optimization',
    Efficiency = 'efficiency',
    Strategic = 'strategic'
}

export interface WhatsAppTemplates {
    paymentReminder: string;
    paymentConfirmation: string;
    declarationNotice: string;
}
