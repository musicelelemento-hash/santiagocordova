import forge from 'node-forge';

export interface P12Metadata {
    commonName: string;
    organization?: string;
    notBefore: Date;
    notAfter: Date;
    isValid: boolean;
    issuerName: string;
    serialNumber: string;
    ruc?: string;
    cedula?: string;
}

/**
 * Decodifica una firma .p12 y extrae sus metadatos usando la contraseña.
 */
export function extractP12Metadata(base64Content: string, password?: string): P12Metadata {
    try {
        // Limpiar el encabezado del DataURL si existe
        const base64Data = base64Content.includes('base64,') 
            ? base64Content.split('base64,')[1] 
            : base64Content;

        // Convertir de base64 a cadena binaria compatible con forge
        const binaryString = forge.util.decode64(base64Data);
        const pkcs12Der = forge.util.createBuffer(binaryString, 'raw');

        // Analizar la estructura DER de la firma
        const asn1 = forge.asn1.fromDer(pkcs12Der);
        
        // Decodificar el almacén de claves PKCS#12
        const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password || '');

        // Obtener certificados
        const bags = pkcs12.getBags({ bagType: forge.pki.oids.certBag });
        const certBags = bags[forge.pki.oids.certBag];
        if (!certBags || certBags.length === 0) {
            throw new Error('No se encontraron certificados en el archivo de firma.');
        }

        // Buscar el certificado del usuario final (evitando certificados de CA intermedia si existen)
        let cert = certBags[0]?.cert;
        for (const bag of certBags) {
            if (bag.cert) {
                const bc = bag.cert.getExtension('basicConstraints') as any;
                // Si el certificado no es CA, preferir este
                if (bc && bc.cA === false) {
                    cert = bag.cert;
                    break;
                }
            }
        }

        if (!cert) {
            throw new Error('Certificado interno no válido.');
        }

        const notBefore = cert.validity.notBefore;
        const notAfter = cert.validity.notAfter;
        const now = new Date();
        const isValid = now >= notBefore && now <= notAfter;

        // Extraer campos clave
        const getSubjectField = (name: string) => {
            const field = cert.subject.getField(name);
            return field ? String(field.value) : undefined;
        };

        const commonName = getSubjectField('CN') || 'Desconocido';
        const organization = getSubjectField('O');
        
        const issuerCNAttr = cert.issuer.getField('CN');
        const issuerName = issuerCNAttr ? String(issuerCNAttr.value) : 'Entidad Certificadora Desconocida';

        let ruc: string | undefined = undefined;
        let cedula: string | undefined = undefined;

        // Recopilar todos los textos del certificado (Subject Attributes + Extensions) para una inspección exhaustiva
        const textSources: string[] = [];

        // 1. Atributos del Subject
        cert.subject.attributes.forEach((attr: any) => {
            if (attr.value) {
                if (typeof attr.value === 'string') {
                    textSources.push(attr.value);
                } else if (attr.value.value && typeof attr.value.value === 'string') {
                    textSources.push(attr.value.value);
                } else {
                    textSources.push(String(attr.value));
                }
            }
        });

        // 2. Extensiones del Certificado (SAN, SAN altNames, Custom OIDs)
        if (cert.extensions && Array.isArray(cert.extensions)) {
            cert.extensions.forEach((ext: any) => {
                if (ext.altNames && Array.isArray(ext.altNames)) {
                    ext.altNames.forEach((an: any) => {
                        if (an.value) textSources.push(String(an.value));
                    });
                }
                if (ext.value && typeof ext.value === 'string') {
                    textSources.push(ext.value);
                }
            });
        }

        // 3. Cadena completa del Subject
        textSources.push(commonName);

        // Buscar primero un RUC (13 dígitos) o Cédula (10 dígitos) usando expresión regular
        for (const text of textSources) {
            // Limpieza de caracteres y búsqueda de secuencias numéricas
            // Formatos comunes: "RUC: 0105256739001", "0105256739001", "PAS-0105256739", "CI 0105256739"
            const match13 = text.match(/\b\d{13}\b/) || text.match(/(?:RUC|CED|CI|PAS|ID)?[\s:-]*(\d{13})/i);
            if (match13 && !ruc) {
                const candidate = match13[1] || match13[0];
                if (/^\d{13}$/.test(candidate)) {
                    ruc = candidate;
                    cedula = candidate.substring(0, 10);
                    break;
                }
            }
        }

        if (!ruc) {
            for (const text of textSources) {
                const match10 = text.match(/\b\d{10}\b/) || text.match(/(?:RUC|CED|CI|PAS|ID)?[\s:-]*(\d{10})/i);
                if (match10 && !cedula) {
                    const candidate = match10[1] || match10[0];
                    if (/^\d{10}$/.test(candidate)) {
                        cedula = candidate;
                        break;
                    }
                }
            }
        }

        if (!cedula && ruc) {
            cedula = ruc.substring(0, 10);
        }

        return {
            commonName,
            organization,
            notBefore,
            notAfter,
            isValid,
            issuerName,
            serialNumber: cert.serialNumber || '',
            ruc,
            cedula
        };
    } catch (err: any) {
        throw new Error(err.message || 'Contraseña incorrecta o firma corrupta.');
    }
}

