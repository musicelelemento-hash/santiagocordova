import { supabase } from './supabase';
import { arePeriodsEqual } from '../components/features/TaxComplianceMatrix';

import { v4 as uuidv4 } from 'uuid';
import { Client, TaxRegime, DeclarationStatus, StoredFile, TaxObligationType } from '../types';
import { extractDataFromSriPdf, extractDataFromDeclarationPdf, fileToBase64 } from './pdfExtraction';
import { useAppStore } from '../store/useAppStore';
import { isCourtesyClient } from './clientService';

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

            // 3. Procesar Documento (NUEVO: Peso Reducido via Supabase Storage)
            let pdfContentStr = "";
            try {
                const uniqueId = Math.random().toString(36).substring(2, 9);
                const filePath = `${data.ruc || 'UNKNOWN'}/${(data as any).period || 'GENERAL'}/${uniqueId}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('sri_proofs')
                    .upload(filePath, file, { upsert: true });
                
                if (uploadError) throw uploadError;
                
                const { data: { publicUrl } } = supabase.storage
                    .from('sri_proofs')
                    .getPublicUrl(filePath);
                
                pdfContentStr = `__SPLIT__:STORAGE:${publicUrl}`;
            } catch (storageErr) {
                console.error("Error uploading to storage, falling back to base64:", storageErr);
                pdfContentStr = await fileToBase64(file); // Fallback
            }

            const storedFile: StoredFile = {
                name: file.name,
                type: 'pdf',
                size: file.size,
                lastModified: file.lastModified,
                content: pdfContentStr,
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
                let type: TaxObligationType = (data.formType === 'IVA' ? 'IVA' : (data.formType === 'RENTA' ? 'RENTA' : (decPeriod.includes('-') ? 'IVA' : 'RENTA'))) as TaxObligationType;

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

                const existingDec = (client.declarations ?? []).find(d => arePeriodsEqual(d.period, decPeriod) && (d.type === type || !d.type));
                
                let shouldReplace = true;
                
                // SMART OVERWRITE LOGIC
                // Los PDFs originales del SRI tienen nombres de solo números (ej. "873083870866.pdf").
                // Los PDFs generados por el bot se llaman "Declaracion_IVA_0707018438001_2026-07.pdf".
                if (existingDec && existingDec.proof_file) {
                    const existingName = existingDec.proof_file.name || '';
                    const isExistingOriginal = /^\d+\.pdf$/i.test(existingName);
                    
                    if (isExistingOriginal) {
                        shouldReplace = false;
                        status = 'duplicate';
                    }
                }

                if (shouldReplace) {
                    const newDec = {
                        period: decPeriod,
                        type,
                        status: DeclarationStatus.Enviada,
                        updatedAt: new Date().toISOString(),
                        declaredAt: (data as any).declarationDate || new Date().toISOString(),
                        amount: (data as any).amount || 0,
                        proof_file: storedFile,
                        is_paid: false,
                        paidAt: undefined,
                        isNotifiedWhatsApp: false,
                        notifiedWhatsAppAt: undefined,
                        notificationCount: 0
                    };

                    const newHistory = [...(client.declarations ?? []).filter(d => !(arePeriodsEqual(d.period, decPeriod) && (d.type === type || !d.type))), newDec];
                    updates.declarations = newHistory;
                    
                    if (existingDec && existingDec.proof_file) {
                        status = 'success'; // Replaced a non-original successfully
                    }
                } else {
                    // No hacemos cambios en las declaraciones si ya existe un original
                    updates.declarations = client.declarations;
                }
            }

            await store.updateClient(client.id, updates);

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
