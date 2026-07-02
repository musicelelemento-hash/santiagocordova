
import { v4 as uuidv4 } from 'uuid';
import { Client, TaxRegime, DeclarationStatus, StoredFile, TaxObligationType } from '../types';
import { extractDataFromSriPdf, extractDataFromDeclarationPdf, fileToBase64 } from './pdfExtraction';
import { useAppStore } from '../store/useAppStore';

export interface BulkProcessResult {
    fileName: string;
    status: 'success' | 'error' | 'duplicate' | 'new_client';
    clientName?: string;
    ruc?: string;
    period?: string;
    type?: string;
    amount?: number;
    error?: string;
    isPaid?: boolean;
    phones?: string[];
}

export const processBulkPdfs = async (
    files: File[],
    onProgress: (current: number, total: number) => void
): Promise<BulkProcessResult[]> => {
    const results: BulkProcessResult[] = [];
    const store = useAppStore.getState();
    const total = files.length;

    for (let i = 0; i < total; i++) {
        const file = files[i];
        onProgress(i + 1, total);

        try {
            // 1. Intentar extraer como Declaración primero (es lo más común en lotes de 170)
            let data;
            let isRegistrationPdf = false;

            try {
                data = await extractDataFromDeclarationPdf(file);
            } catch (e) {
                // Si falla, intentar como PDF del SRI (Registro/RUC)
                try {
                    const sriData = await extractDataFromSriPdf(file);
                    isRegistrationPdf = true;
                    data = {
                        ruc: sriData.ruc,
                        clientName: sriData.apellidos_nombres,
                        regime: sriData.regimen,
                        ivaFrequency: sriData.obligaciones_tributarias === 'semestral' ? 'Semestral' : 'Mensual',
                        address: sriData.direccion,
                        phone: sriData.contacto.celular,
                        email: sriData.contacto.email,
                        isCertificate: sriData.isCertificate
                    };
                } catch (e2) {
                    results.push({ fileName: file.name, status: 'error', error: 'Formato de PDF no reconocido' });
                    continue;
                }
            }

            if (!data.ruc) {
                results.push({ fileName: file.name, status: 'error', error: 'No se detectó RUC' });
                continue;
            }

            // 2. Buscar Cliente
            let client = store.getClientByRuc(data.ruc);
            let status: BulkProcessResult['status'] = 'success';
            let clientName = client?.name || (data as any).clientName || 'Nuevo Cliente';

            // VALIDACIÓN ESTRICTA DE PERIODO (No más de 2 años de antigüedad sin aviso)
            const currentYear = new Date().getFullYear();
            const pdfPeriod = (data as any).period || '';
            const pdfYear = parseInt(pdfPeriod.split('-')[0]);
            
            if (pdfYear && pdfYear < currentYear - 1) {
                results.push({ 
                    fileName: file.name, 
                    status: 'error', 
                    error: `ARCHIVO ANTIGUO: El PDF es del año ${pdfYear}. Verifique si es el correcto.` 
                });
                continue;
            }

            if (!client) {
                // AUTO-REGISTRO TÁCTICO - MARCADO COMO "PENDING REVIEW"
                const newClientId = uuidv4();
                const newClient: Client = {
                    id: newClientId,
                    ruc: data.ruc,
                    name: (data as any).clientName || 'Contribuyente Detectado',
                    sriPassword: '',
                    regime: (data as any).regime || TaxRegime.General,
                    declarations: [],
                    isActive: true,
                    needsVerification: true,
                    verificationReason: `Registrado automáticamente via Bulk Upload. Detectado como: ${(data as any).clientName}`,
                    address: (data as any).address || '',
                    phones: (data as any).phone ? [(data as any).phone] : [],
                    email: (data as any).email || '',
                    taxProfile: {
                        ivaFrequency: (data as any).ivaFrequency || 'Mensual',
                        requiresAnnualRenta: true,
                        requiresAnexosGastos: false,
                        hasActiveDevolucionIva: false,
                        hasActiveElderlyDevolucionIva: false,
                        requiresIce: false,
                        requiresAnexoPvp: false
                    },
                    vault: [],
                    structuredNotes: []
                };

                store.addClient(newClient);
                client = newClient;
                status = 'new_client';
                clientName = newClient.name;
            }

            // 3. Procesar Documento
            const fileBase64 = await fileToBase64(file);
            const storedFile: StoredFile = {
                name: file.name,
                type: 'pdf',
                size: file.size,
                lastModified: file.lastModified,
                content: fileBase64,
                metadata: {
                    uploadedAt: new Date().toISOString(),
                    period: (data as any).period || 'S/P',
                    amount: (data as any).amount || 0,
                    formType: (data as any).formType || ((data as any).isCertificate ? 'CERTIFICADO RUC' : (isRegistrationPdf ? 'RUC/REGISTRO' : 'DOCUMENTO'))
                }
            };

            // 4. Actualizar Cliente (Bóveda + Historial si es declaración)
            const updates: Partial<Client> = {
                vault: [...(client.vault || []), storedFile],
                updatedAt: new Date().toISOString()
            };

            if (isRegistrationPdf) {
                if ((data as any).isCertificate) {
                    updates.rucCertificate = storedFile;
                } else {
                    updates.rucPdf = storedFile;
                }
            } else if ((data as any).period) {
                let decPeriod = (data as any).period;
                let type: TaxObligationType = (decPeriod.includes('-') ? 'IVA' : 'RENTA') as TaxObligationType;

                if (data.formType === 'ICE') {
                    if (!decPeriod.includes(':ICE')) {
                        decPeriod = `${decPeriod.split(':')[0]}:ICE`;
                    }
                    type = 'ICE';
                } else if (data.formType === 'ANEXO_ICE') {
                    if (!decPeriod.includes(':ANEXO_ICE')) {
                        decPeriod = `${decPeriod.split(':')[0]}:ANEXO_ICE`;
                    }
                    type = 'ANEXO';
                } else if (data.formType === 'PVP') {
                    if (!decPeriod.includes(':PVP')) {
                        decPeriod = `${decPeriod.split(':')[0]}:PVP`;
                    }
                    type = 'PVP';
                }

                const existingDec = client.declarations.find(d => d.period === decPeriod);
                
                if (existingDec && (existingDec.status === DeclarationStatus.Enviada || existingDec.status === DeclarationStatus.Pagada)) {
                    // Evitar duplicados si ya está enviada o pagada, pero adjuntar el archivo
                    status = 'duplicate';
                } else {
                    const newDec = {
                        period: decPeriod,
                        type,
                        status: client.isCourtesy ? DeclarationStatus.Pagada : DeclarationStatus.Enviada,
                        updatedAt: new Date().toISOString(),
                        declaredAt: (data as any).declarationDate || new Date().toISOString(),
                        amount: (data as any).amount || 0,
                        proof_file: storedFile,
                        is_paid: client.isCourtesy ? true : false,
                        paidAt: client.isCourtesy ? new Date().toISOString() : undefined
                    };
 
                    const newHistory = [...client.declarations.filter(d => d.period !== decPeriod), newDec];
                    updates.declarations = newHistory;
                }
            }

            store.updateClient(client.id, updates);

            results.push({
                fileName: file.name,
                status,
                clientName,
                ruc: data.ruc,
                period: (data as any).period,
                type: (data as any).formType || (isRegistrationPdf ? 'REGISTRO' : 'PDF'),
                amount: (data as any).amount,
                phones: client.phones
            });

        } catch (error: any) {
            results.push({ fileName: file.name, status: 'error', error: error.message || 'Error desconocido' });
        }
    }

    return results;
};
