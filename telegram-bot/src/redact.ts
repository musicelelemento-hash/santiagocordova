/**
 * Utilidades de redacción de credenciales para Baku.
 *
 * Objetivo de seguridad: las respuestas que "vuelcan" un perfil completo de cliente
 * (ficha 360°, search_client, listados) NO deben exponer contraseñas en texto plano.
 * Las consultas explícitas de un único campo (get_client_field / get_sri_credential)
 * sí devuelven el valor real porque son peticiones puntuales y dirigidas.
 */

/** Campos considerados sensibles: sus valores NUNCA deben mostrarse en claro en vistas masivas. */
export const SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
    'sri_password', 'sriPassword', 'clave', 'clave_sri', 'claveSri',
    'iess_password', 'iessPassword',
    'signature_password', 'signaturePassword', 'electronicSignaturePassword',
    'electronic_signature_password', 'clave_firma', 'claveFirma', 'firma',
    'shared_access_key', 'sharedAccessKey',
    'billing_password', 'clave_facturador', 'claveFacturador', 'contrasena_facturador',
    'password', 'clave',
]);

/**
 * Devuelve true si el nombre de campo (en cualquier convención, camelCase o snake_case)
 * corresponde a una credencial sensible.
 */
export function isSensitiveField(fieldName: string): boolean {
    if (!fieldName) return false;
    const norm = fieldName.toLowerCase().replace(/_/g, '');
    return SENSITIVE_FIELDS.has(fieldName.toLowerCase()) || SENSITIVE_FIELDS.has(norm);
}

/**
 * Enmascara un secreto mostrando solo un prefijo y un sufijo cortos.
 * Ej: "m1SecretPassw0rd9" → "m1••••••d9". Valores muy cortos se sustituyen por puntos.
 */
export function maskSecret(value: string | null | undefined, visible: number = 2): string {
    const raw = (value ?? '').toString().trim();
    if (!raw) return '';
    // Demasiado corto para mostrar extremos sin delatar el valor completo
    if (raw.length <= (visible * 2) + 1) {
        return '*'.repeat(Math.max(4, Math.min(raw.length, 8)));
    }
    return `${raw.slice(0, visible)}${'•'.repeat(6)}${raw.slice(-visible)}`;
}

/**
 * Aplica enmascarado a un valor si el campo es sensible; si no lo es, devuelve el valor tal cual.
 * Conveniente para plantillas genéricas de renderizado de campos.
 */
export function renderFieldValue(fieldName: string, value: unknown): string {
    if (isSensitiveField(fieldName) && value != null && value !== '') {
        return maskSecret(String(value));
    }
    return value == null ? '' : String(value);
}
