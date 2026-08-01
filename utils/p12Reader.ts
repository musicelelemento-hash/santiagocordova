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

        // Buscar el primer certificado válido que contenga información útil
        const cert = certBags[0].cert;
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

        // Inspeccionar los atributos del subject para extraer RUC o Cédula (Ecuador)
        cert.subject.attributes.forEach((attr: any) => {
            const val = String(attr.value);
            // El campo serialNumber o OID de identificación suele contener el RUC o la cédula
            if (attr.name === 'serialNumber' || attr.type === '2.5.4.5') {
                if (val.length === 10 && /^\d+$/.test(val)) {
                    cedula = val;
                } else if (val.length === 13 && /^\d+$/.test(val)) {
                    ruc = val;
                    cedula = val.substring(0, 10);
                }
            }

            // Búsqueda proactiva por longitud y formato numérico
            const matchDigits = val.match(/\b\d{10,13}\b/);
            if (matchDigits) {
                const num = matchDigits[0];
                if (num.length === 13) {
                    ruc = num;
                } else if (num.length === 10) {
                    cedula = num;
                }
            }
        });

        // Intentar autocompletar si no se pudo mapear el RUC/Cédula y el Common Name contiene el RUC del dueño
        if (!ruc) {
            const rucMatch = commonName.match(/\b\d{13}\b/);
            if (rucMatch) ruc = rucMatch[0];
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
