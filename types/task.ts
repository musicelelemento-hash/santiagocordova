
export enum TaskStatus {
    Pendiente = 'Pendiente',
    EnProceso = 'En Proceso',
    Completada = 'Completada',
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
    dueDate: string;
    status: TaskStatus;
    attachments?: File[];
    cost?: number;
    advancePayment?: number;
}
