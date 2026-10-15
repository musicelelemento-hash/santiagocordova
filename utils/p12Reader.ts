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
 * Validador oficial de Cédula ecuatoriana (Algoritmo Módulo 10).
 */
export function isValidCedula(cedula?: string): boolean {
    if (!cedula || !/^\d{10}$/.test(cedula)) return false;
    const prov = parseInt(cedula.substring(0, 2), 10);
    if ((prov < 1 || prov > 24) && prov !== 30) return false;
    const third = parseInt(cedula.charAt(2), 10);
    if (third > 5) return false; // Persona natural: tercer dígito 0 a 5
    const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        let val = parseInt(cedula.charAt(i), 10) * coef[i];
        if (val >= 10) val -= 9;
        sum += val;
    }
    const verifier = (10 - (sum % 10)) % 10;
    return verifier === parseInt(cedula.charAt(9), 10);
}

/**
 * Validador oficial de RUC ecuatoriano (Persona Natural, Sociedad Privada, Sociedad Pública).
 * En Ecuador TODO RUC legal consta de 13 dígitos y finaliza en 001 (o establecimiento 002-999).
 */
export function isValidRuc(ruc?: string): boolean {
    if (!ruc || !/^\d{13}$/.test(ruc)) return false;
    const prov = parseInt(ruc.substring(0, 2), 10);
    if ((prov < 1 || prov > 24) && prov !== 30) return false;
    const third = parseInt(ruc.charAt(2), 10);
    const establishment = ruc.substring(10, 13);
    if (establishment === '000') return false; // En Ecuador el establecimiento mínimo es 001

    // 1. Persona Natural (tercer dígito 0 a 5): Los primeros 10 dígitos deben ser cédula válida
    if (third <= 5) {
        const cedulaPart = ruc.substring(0, 10);
        return isValidCedula(cedulaPart);
    }

    // 2. Sociedad Privada / Extranjera sin cédula (tercer dígito 9 - Módulo 11)
    if (third === 9) {
        const coef = [4, 3, 2, 7, 6, 5, 4, 3, 2];
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(ruc.charAt(i), 10) * coef[i];
        }
        const res = sum % 11;
        const verifier = res === 0 ? 0 : 11 - res;
        return verifier === parseInt(ruc.charAt(9), 10);
    }

    // 3. Sociedad Pública (tercer dígito 6 - Módulo 11)
    if (third === 6) {
        const coef = [3, 2, 7, 6, 5, 4, 3, 2];
        let sum = 0;
        for (let i = 0; i < 8; i++) {
            sum += parseInt(ruc.charAt(i), 10) * coef[i];
        }
        const res = sum % 11;
        const verifier = res === 0 ? 0 : 11 - res;
        return verifier === parseInt(ruc.charAt(8), 10);
    }

    return false;
}

const cleanAsn1Value = (val: any): string => {
    if (typeof val === 'string') {
        return val.replace(/^[\x00-\x1f]+/, '').trim();
    }
    if (val && typeof val.value === 'string') {
        return val.value.replace(/^[\x00-\x1f]+/, '').trim();
    }
    return '';
};

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

        // OIDs Oficiales de Entidades de Certificación en Ecuador:
        // - Security Data / Corpnewbest (1.3.6.1.4.1.34380.3.* y 1.3.6.1.4.1.37442.*)
        // - Banco Central del Ecuador / Registro Civil (1.3.6.1.4.1.37947.3.*)
        // - ICERT-EC Consejo de la Judicatura (1.3.6.1.4.1.43766.3.*)
        // - ANFAC / Uanataca
        const RUC_OIDS = [
            '1.3.6.1.4.1.34380.3.11',
            '1.3.6.1.4.1.37947.3.11',
            '1.3.6.1.4.1.37442.2.2',
            '1.3.6.1.4.1.43766.3.11'
        ];

        const CEDULA_OIDS = [
            '1.3.6.1.4.1.34380.3.1',
            '1.3.6.1.4.1.37947.3.1',
            '1.3.6.1.4.1.37442.2.1',
            '1.3.6.1.4.1.43766.3.1'
        ];

        // Extensiones técnicas a IGNORAR categóricamente para evitar capturar marcas de tiempo o hashes como RUC:
        // 2.5.29.16 (privateKeyUsagePeriod) contiene cadenas como "20260812211615Z" que anteriormente
        // se confundían con un RUC de 13 dígitos por tener longitud similar.
        const ignoredExtensionOids = new Set([
            '2.5.29.16', // privateKeyUsagePeriod (causa raíz del falso RUC 2026...)
            '2.5.29.31', // cRLDistributionPoints
            '2.5.29.46', // freshestCRL
            '1.3.6.1.5.5.7.1.1', // authorityInfoAccess
            '2.5.29.35', // authorityKeyIdentifier
            '2.5.29.14', // subjectKeyIdentifier
            '2.5.29.32', // certificatePolicies
            '2.5.29.19', // basicConstraints
            '2.5.29.15', // keyUsage
            '2.5.29.37'  // extKeyUsage
        ]);

        const extMap: Record<string, string> = {};
        if (cert.extensions && Array.isArray(cert.extensions)) {
            cert.extensions.forEach((ext: any) => {
                const oid = ext.id || ext.name;
                if (oid && !ignoredExtensionOids.has(oid)) {
                    const clean = cleanAsn1Value(ext.value);
                    if (clean) extMap[oid] = clean;
                }
            });
        }

        // 1. Prioridad: Inspección en OIDs dedicados de RUC
        for (const oid of RUC_OIDS) {
            const val = extMap[oid];
            if (val) {
                const digits = val.replace(/\D/g, '');
                if (isValidRuc(digits)) {
                    ruc = digits;
                    break;
                }
            }
        }

        // 2. Prioridad: Inspección en OIDs dedicados de Cédula
        for (const oid of CEDULA_OIDS) {
            const val = extMap[oid];
            if (val) {
                const digits = val.replace(/\D/g, '');
                if (isValidCedula(digits)) {
                    cedula = digits;
                    break;
                }
            }
        }

        // 3. Inspección en Atributos del Subject (serialNumber, description, uniqueIdentifier, etc.)
        const candidateTexts: string[] = [];
        cert.subject.attributes.forEach((attr: any) => {
            const name = attr.name || attr.type;
            if (['serialNumber', 'description', 'uniqueIdentifier', 'CN', 'OU'].includes(name)) {
                const clean = cleanAsn1Value(attr.value);
                if (clean) candidateTexts.push(clean);
            }
        });

        // SAN altNames
        if (cert.extensions && Array.isArray(cert.extensions)) {
            cert.extensions.forEach((ext: any) => {
                if (ext.altNames && Array.isArray(ext.altNames)) {
                    ext.altNames.forEach((an: any) => {
                        const clean = cleanAsn1Value(an.value);
                        if (clean) candidateTexts.push(clean);
                    });
                }
            });
        }

        // Buscar RUC válido en textos del Subject/SAN
        if (!ruc) {
            for (const text of candidateTexts) {
                const matches = text.match(/\d{13}/g) || [];
                for (const m of matches) {
                    if (isValidRuc(m)) {
                        ruc = m;
                        break;
                    }
                }
                if (ruc) break;
            }
        }

        // Buscar Cédula válida en textos del Subject/SAN
        if (!cedula) {
            for (const text of candidateTexts) {
                const matches = text.match(/\d{10}/g) || [];
                for (const m of matches) {
                    if (isValidCedula(m)) {
                        cedula = m;
                        break;
                    }
                }
                if (cedula) break;
            }
        }

        // 4. Si se detectó Cédula pero no RUC explícito, derivar RUC = Cédula + '001' (norma tributaria ecuatoriana)
        if (!ruc && cedula && isValidCedula(cedula)) {
            ruc = `${cedula}001`;
        }

        // 5. Si se detectó RUC pero no Cédula (en Persona Natural), derivar Cédula = ruc.substring(0, 10)
        if (!cedula && ruc && ruc.length === 13 && parseInt(ruc.charAt(2), 10) <= 5) {
            const derivedCed = ruc.substring(0, 10);
            if (isValidCedula(derivedCed)) {
                cedula = derivedCed;
            }
        }

        // Si no se encuentra un RUC legalmente verificable, ruc queda como undefined ("si en caso no lo sabe que no lo pongan")
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
