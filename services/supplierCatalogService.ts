import { Client } from '../types';

export type SupplierCategory =
    | 'bancos_financiero'
    | 'supermercados_alimentos'
    | 'combustibles_transporte'
    | 'telecomunicaciones'
    | 'servicios_profesionales'
    | 'ferreteria_construccion'
    | 'salud_farmacia'
    | 'servicios_basicos'
    | 'general';

export type TaxCreditDefault =
    | 'con_credito'       // Casillero 500/510 (por defecto genera crédito para la actividad)
    | 'sin_credito'       // Casillero 502/512 (por defecto gasto personal / sin crédito)
    | 'segun_actividad'   // Depende del giro del cliente
    | 'tarifa_cero';      // Casillero 507/517

export interface SupplierRecord {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    categoria: SupplierCategory;
    reglaGeneral: TaxCreditDefault;
    notas?: string;
    updatedAt?: string;
}

export interface PurchaseInvoiceItem {
    id: string;
    numero?: number;
    secuencial?: string;
    fechaEmision?: string;
    rucEmisor: string;
    razonSocial: string;
    categoria?: SupplierCategory;
    valorSinImpuestos: number;
    iva: number;
    importeTotal: number;
    tieneCreditoTributario: boolean; // true -> 500/510, false -> 502/512
    tarifaIva?: number;              // 15, 5, 0
    tipoComprobante?: 'factura' | 'nota_credito' | 'liquidacion';
    esManual?: boolean;
}

export interface ClientPurchasesSummary {
    totalFacturas: number;
    base15ConCredito: number; // -> Casillero 500
    iva15ConCredito: number;  // -> Crédito IVA (520)
    base15SinCredito: number; // -> Casillero 502
    iva15SinCredito: number;  // IVA de compras personales
    base5: number;            // -> Casillero 540
    iva5: number;             // -> IVA al 5%
    base0: number;            // -> Casillero 507
    totalBase: number;
    totalIva: number;
    totalGasto: number;
}

export interface ClientPurchasesAudit {
    ruc: string;
    period: string; // e.g. "2026-08"
    updatedAt: string;
    invoices: PurchaseInvoiceItem[];
    summary: ClientPurchasesSummary;
}

export interface ClientPurchasesDisplayData {
    totalDocs: number;
    base15: number;
    iva15: number;
    base15SinCredito: number;
    iva15SinCredito: number;
    base5: number;
    iva5: number;
    base0: number;
    totalBase: number;
    totalIva: number;
    topProviders: Array<{
        nombre: string;
        ruc?: string;
        monto: number;
        facturas?: number;
    }>;
    hasData: boolean;
    source: 'invoices' | 'resumen' | 'extension' | 'declaration' | 'none';
}

export interface EconomicActivityOption {
    id: string;
    label: string;
    description: string;
    eligibleCategories: SupplierCategory[];
}

export const ECONOMIC_ACTIVITIES: EconomicActivityOption[] = [
    {
        id: 'servicios_profesionales',
        label: 'Servicios Profesionales / Asesoría',
        description: 'Honorarios, consultoría, médicos, abogados, ingenieros, contadores.',
        eligibleCategories: ['telecomunicaciones', 'servicios_profesionales', 'bancos_financiero', 'servicios_basicos', 'general']
    },
    {
        id: 'comercio',
        label: 'Comercio al por Mayor y Menor',
        description: 'Tiendas, bazares, ferreterías, compra-venta de mercadería, repuestos.',
        eligibleCategories: ['supermercados_alimentos', 'ferreteria_construccion', 'telecomunicaciones', 'bancos_financiero', 'combustibles_transporte', 'servicios_basicos', 'general']
    },
    {
        id: 'transporte',
        label: 'Transporte y Logística',
        description: 'Taxis, camionetas, carga pesada, fletes, transporte escolar e institucional.',
        eligibleCategories: ['combustibles_transporte', 'telecomunicaciones', 'bancos_financiero', 'ferreteria_construccion', 'general']
    },
    {
        id: 'construccion',
        label: 'Construcción e Inmobiliaria',
        description: 'Obras civiles, contratistas, arriendos, remodelación, arquitectura.',
        eligibleCategories: ['ferreteria_construccion', 'combustibles_transporte', 'servicios_profesionales', 'telecomunicaciones', 'bancos_financiero', 'general']
    },
    {
        id: 'agropecuario',
        label: 'Agropecuario, Bananero y Acuícola',
        description: 'Fincas, haciendas bananeras, camaroneras, cacao, ganado.',
        eligibleCategories: ['combustibles_transporte', 'ferreteria_construccion', 'telecomunicaciones', 'bancos_financiero', 'servicios_basicos', 'general']
    },
    {
        id: 'gastronomia',
        label: 'Gastronomía y Alimentos',
        description: 'Restaurantes, cafeterías, servicios de catering, panaderías.',
        eligibleCategories: ['supermercados_alimentos', 'servicios_basicos', 'telecomunicaciones', 'bancos_financiero', 'general']
    },
    {
        id: 'artesanal',
        label: 'Artesano / Manufactura',
        description: 'Talleres mecánicos, confección, carpintería, artesanos calificados.',
        eligibleCategories: ['ferreteria_construccion', 'servicios_basicos', 'telecomunicaciones', 'bancos_financiero', 'general']
    },
    {
        id: 'general',
        label: 'Actividad Económica General',
        description: 'Emprendimiento o giro comercial general sin especificación restrictiva.',
        eligibleCategories: ['telecomunicaciones', 'servicios_basicos', 'bancos_financiero', 'general']
    }
];

export const CATEGORY_LABELS: Record<SupplierCategory, { label: string; color: string; bg: string; border: string }> = {
    bancos_financiero: {
        label: 'Bancos / Servicios Financieros',
        color: 'text-amber-500 dark:text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30'
    },
    supermercados_alimentos: {
        label: 'Supermercados / Alimentos',
        color: 'text-rose-500 dark:text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30'
    },
    combustibles_transporte: {
        label: 'Combustibles / Transporte',
        color: 'text-orange-500 dark:text-orange-400',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30'
    },
    telecomunicaciones: {
        label: 'Telecomunicaciones / Internet',
        color: 'text-cyan-500 dark:text-cyan-400',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30'
    },
    servicios_profesionales: {
        label: 'Servicios Profesionales / Asesoría',
        color: 'text-blue-500 dark:text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30'
    },
    ferreteria_construccion: {
        label: 'Ferretería / Construcción',
        color: 'text-emerald-500 dark:text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30'
    },
    salud_farmacia: {
        label: 'Salud / Farmacias',
        color: 'text-pink-500 dark:text-pink-400',
        bg: 'bg-pink-500/10',
        border: 'border-pink-500/30'
    },
    servicios_basicos: {
        label: 'Servicios Básicos (Luz/Agua)',
        color: 'text-teal-500 dark:text-teal-400',
        bg: 'bg-teal-500/10',
        border: 'border-teal-500/30'
    },
    general: {
        label: 'General / Operativo',
        color: 'text-slate-400 dark:text-slate-300',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30'
    }
};

// ── Catálogo Inicial Maestro de Proveedores Frecuentes en Ecuador ─────────────
const MASTER_SUPPLIERS: SupplierRecord[] = [
    {
        ruc: '1790010937001',
        razonSocial: 'BANCO PICHINCHA C.A.',
        nombreComercial: 'BANCO PICHINCHA',
        categoria: 'bancos_financiero',
        reglaGeneral: 'con_credito',
        notas: 'Comisiones y servicios bancarios operativos vinculados a cuentas de negocio.'
    },
    {
        ruc: '0990000514001',
        razonSocial: 'BANCO DE GUAYAQUIL S.A.',
        nombreComercial: 'BANCO GUAYAQUIL',
        categoria: 'bancos_financiero',
        reglaGeneral: 'con_credito',
        notas: 'Comisiones bancarias y mantenimiento de cuenta empresarial.'
    },
    {
        ruc: '0990005746001',
        razonSocial: 'BANCO DEL PACIFICO S.A.',
        nombreComercial: 'BANCO DEL PACIFICO',
        categoria: 'bancos_financiero',
        reglaGeneral: 'con_credito',
        notas: 'Comisiones financieras.'
    },
    {
        ruc: '0990004197001',
        razonSocial: 'BANCO BOLIVARIANO C.A.',
        nombreComercial: 'BANCO BOLIVARIANO',
        categoria: 'bancos_financiero',
        reglaGeneral: 'con_credito'
    },
    {
        ruc: '0190003809001',
        razonSocial: 'BANCO DEL AUSTRO S.A.',
        nombreComercial: 'BANCO DEL AUSTRO',
        categoria: 'bancos_financiero',
        reglaGeneral: 'con_credito'
    },
    {
        ruc: '1790016919001',
        razonSocial: 'CORPORACION FAVORITA C.A.',
        nombreComercial: 'SUPERMAXI / AKI / MEGAMAXI',
        categoria: 'supermercados_alimentos',
        reglaGeneral: 'sin_credito',
        notas: 'Supermercado de consumo familiar. Generalmente Sin Crédito Tributario (502), salvo restaurantes o cafeterías.'
    },
    {
        ruc: '0990017514001',
        razonSocial: 'TIENDAS INDUSTRIALES ASOCIADAS (TIA) S.A.',
        nombreComercial: 'ALMACENES TIA',
        categoria: 'supermercados_alimentos',
        reglaGeneral: 'sin_credito',
        notas: 'Alimentos y consumo doméstico. Sin crédito salvo giros gastronómicos o de víveres.'
    },
    {
        ruc: '0190000329001',
        razonSocial: 'IMPORTADORA TOMEBAMBA S.A.',
        nombreComercial: 'CORAL HIPERMERCADOS',
        categoria: 'supermercados_alimentos',
        reglaGeneral: 'sin_credito'
    },
    {
        ruc: '1791256115001',
        razonSocial: 'CONECEL S.A.',
        nombreComercial: 'CLARO',
        categoria: 'telecomunicaciones',
        reglaGeneral: 'con_credito',
        notas: 'Telefonía e internet móvil para comunicación operativa con clientes.'
    },
    {
        ruc: '1791251237001',
        razonSocial: 'OTECEL S.A.',
        nombreComercial: 'MOVISTAR',
        categoria: 'telecomunicaciones',
        reglaGeneral: 'con_credito',
        notas: 'Líneas móviles operativas.'
    },
    {
        ruc: '1768152560001',
        razonSocial: 'CORPORACION NACIONAL DE TELECOMUNICACIONES CNT EP',
        nombreComercial: 'CNT EP',
        categoria: 'telecomunicaciones',
        reglaGeneral: 'con_credito',
        notas: 'Internet fijo de fibra óptica y telefonía de oficina/establecimiento.'
    },
    {
        ruc: '1768153530001',
        razonSocial: 'EMPRESA PUBLICA DE HIDROCARBUROS DEL ECUADOR EP PETROECUADOR',
        nombreComercial: 'PETROECUADOR',
        categoria: 'combustibles_transporte',
        reglaGeneral: 'segun_actividad',
        notas: 'Combustible. Con crédito para transporte, carga y agro; sin crédito o proporción para profesionales.'
    },
    {
        ruc: '1791789725001',
        razonSocial: 'PRIMAX COMERCIAL DEL ECUADOR S.A.',
        nombreComercial: 'PRIMAX',
        categoria: 'combustibles_transporte',
        reglaGeneral: 'segun_actividad'
    },
    {
        ruc: '0992224792001',
        razonSocial: 'TERPEL-ECUADOR COMPAÑIA DE COMERCIO S.A.',
        nombreComercial: 'TERPEL',
        categoria: 'combustibles_transporte',
        reglaGeneral: 'segun_actividad'
    },
    {
        ruc: '1791715845001',
        razonSocial: 'FARMAENLACE CIA. LTDA.',
        nombreComercial: 'FARMACIAS ECONOMICAS / MEDACITY',
        categoria: 'salud_farmacia',
        reglaGeneral: 'sin_credito',
        notas: 'Salud y medicinas. Gasto personal (Casillero 502).'
    },
    {
        ruc: '0992144349001',
        razonSocial: 'DIFAL S.A.',
        nombreComercial: 'FARMACIAS CRUZ AZUL / COMUNITARIAS',
        categoria: 'salud_farmacia',
        reglaGeneral: 'sin_credito'
    },
    {
        ruc: '1790699706001',
        razonSocial: 'BEKAPHARMA S.A.',
        nombreComercial: 'FYBECA / SANA SANA',
        categoria: 'salud_farmacia',
        reglaGeneral: 'sin_credito'
    },
    {
        ruc: '1790165841001',
        razonSocial: 'KYWI S.A.',
        nombreComercial: 'FERRETERIA KYWI / MEGAMAXI HOGAR',
        categoria: 'ferreteria_construccion',
        reglaGeneral: 'segun_actividad',
        notas: 'Ferretería y acabados. Con crédito si el cliente es construcción o comercio; sin crédito si es personal.'
    },
    {
        ruc: '0990001731001',
        razonSocial: 'HOLCIM ECUADOR S.A.',
        nombreComercial: 'DISENSA / CEMENTO HOLCIM',
        categoria: 'ferreteria_construccion',
        reglaGeneral: 'segun_actividad'
    },
    {
        ruc: '0791726354001',
        razonSocial: 'FERRETERIA EL ORO S.A.',
        nombreComercial: 'FERRETERIA EL ORO',
        categoria: 'ferreteria_construccion',
        reglaGeneral: 'segun_actividad'
    },
    {
        ruc: '0968599020001',
        razonSocial: 'CORPORACION ELECTRICA DEL ECUADOR CNEL EP',
        nombreComercial: 'CNEL EP',
        categoria: 'servicios_basicos',
        reglaGeneral: 'tarifa_cero',
        notas: 'Servicio de energía eléctrica (Tarifa 0% - Casillero 507/517).'
    },
    {
        ruc: '0760000300001',
        razonSocial: 'EMPRESA PUBLICA DE AGUA POTABLE AGUAS MACHALA EP',
        nombreComercial: 'AGUAS MACHALA',
        categoria: 'servicios_basicos',
        reglaGeneral: 'tarifa_cero',
        notas: 'Agua potable y alcantarillado (Tarifa 0% - Casillero 507/517).'
    }
];

const STORAGE_CATALOG_KEY = 'sc_catalogo_proveedores_general';

export class SupplierCatalogService {
    /**
     * Carga el catálogo general de proveedores (desde almacenamiento local con fallback al catálogo maestro).
     */
    static getCatalog(): Record<string, SupplierRecord> {
        try {
            const raw = localStorage.getItem(STORAGE_CATALOG_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (typeof parsed === 'object' && parsed !== null) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('⚠️ Error al leer catálogo de proveedores:', e);
        }

        // Inicializar con maestros
        const initialMap: Record<string, SupplierRecord> = {};
        MASTER_SUPPLIERS.forEach(s => {
            initialMap[s.ruc] = s;
        });

        try {
            localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(initialMap));
        } catch {}

        return initialMap;
    }

    /**
     * Guarda o actualiza un proveedor en el catálogo general.
     */
    static saveSupplier(supplier: SupplierRecord): void {
        const catalog = this.getCatalog();
        const rucClean = supplier.ruc.replace(/\D/g, '').trim();
        if (rucClean.length !== 13) return;

        catalog[rucClean] = {
            ...supplier,
            ruc: rucClean,
            updatedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(catalog));
            // Sincronizar también con la extensión
            const extFormat: Record<string, any> = {};
            Object.values(catalog).forEach(s => {
                extFormat[s.ruc] = {
                    nombre: s.razonSocial,
                    actividad: s.categoria,
                    deducible: s.reglaGeneral === 'con_credito' ? true : (s.reglaGeneral === 'sin_credito' ? false : null)
                };
            });
            localStorage.setItem('sc_proveedores', JSON.stringify(extFormat));
        } catch (e) {
            console.error('Error al guardar proveedor:', e);
        }
    }

    /**
     * Busca un proveedor por RUC o coincidencia en razón social.
     */
    static findSupplier(rucOrName: string): SupplierRecord | null {
        const catalog = this.getCatalog();
        const clean = rucOrName.replace(/\D/g, '').trim();
        if (clean.length === 13 && catalog[clean]) {
            return catalog[clean];
        }

        const lower = rucOrName.toLowerCase().trim();
        const found = Object.values(catalog).find(s =>
            s.ruc.includes(clean) ||
            s.razonSocial.toLowerCase().includes(lower) ||
            (s.nombreComercial && s.nombreComercial.toLowerCase().includes(lower))
        );

        return found || null;
    }

    /**
     * Evalúa si una compra de este proveedor debe llevar Crédito Tributario (Casillero 500)
     * o Sin Crédito Tributario (Casillero 502) basándose en la actividad del cliente.
     */
    static evaluateTaxCredit(supplier: SupplierRecord | null, clientActivityId?: string, tarifaIva = 15): {
        tieneCredito: boolean;
        motivo: string;
        casilleroSugerido: '500' | '502' | '507' | '540';
    } {
        if (tarifaIva === 0) {
            return {
                tieneCredito: false,
                motivo: 'Compra con tarifa 0% de IVA',
                casilleroSugerido: '507'
            };
        }

        if (tarifaIva === 5) {
            return {
                tieneCredito: true,
                motivo: 'Compra con tarifa reducida 5% (Construcción / Materiales)',
                casilleroSugerido: '540'
            };
        }

        if (!supplier) {
            // Proveedor no registrado en catálogo: por defecto se asume crédito si no parece supermercado/farmacia
            return {
                tieneCredito: true,
                motivo: 'Proveedor no catalogado (clasificación predeterminada con crédito)',
                casilleroSugerido: '500'
            };
        }

        // Si la regla general del proveedor es explícita
        if (supplier.reglaGeneral === 'sin_credito') {
            // Excepción: Si es supermercado y el cliente es gastronomía
            if (supplier.categoria === 'supermercados_alimentos' && clientActivityId === 'gastronomia') {
                return {
                    tieneCredito: true,
                    motivo: 'Insumo alimenticio para restaurante/gastronomía (Crédito 100%)',
                    casilleroSugerido: '500'
                };
            }
            return {
                tieneCredito: false,
                motivo: `${supplier.razonSocial} es gasto personal / consumo no afecto a la actividad`,
                casilleroSugerido: '502'
            };
        }

        if (supplier.reglaGeneral === 'con_credito') {
            return {
                tieneCredito: true,
                motivo: `${supplier.categoria === 'bancos_financiero' ? 'Comisión u operación bancaria' : 'Gasto operativo'} necesario para la actividad`,
                casilleroSugerido: '500'
            };
        }

        // Si depende de la actividad del cliente
        const activity = ECONOMIC_ACTIVITIES.find(a => a.id === clientActivityId);
        if (activity) {
            const esElegible = activity.eligibleCategories.includes(supplier.categoria);
            return {
                tieneCredito: esElegible,
                motivo: esElegible
                    ? `Compatible con la actividad de ${activity.label}`
                    : `No vinculado directamente al giro de ${activity.label} (Gasto no deducible)`,
                casilleroSugerido: esElegible ? '500' : '502'
            };
        }

        return {
            tieneCredito: true,
            motivo: 'Clasificación general',
            casilleroSugerido: '500'
        };
    }

    /**
     * Calcula los totales impositivos para los casilleros del Formulario 104 del SRI.
     */
    static calculateSummary(invoices: PurchaseInvoiceItem[]): ClientPurchasesSummary {
        let base15ConCredito = 0;
        let iva15ConCredito = 0;
        let base15SinCredito = 0;
        let iva15SinCredito = 0;
        let base5 = 0;
        let iva5 = 0;
        let base0 = 0;
        let totalBase = 0;
        let totalIva = 0;
        let totalGasto = 0;

        invoices.forEach(inv => {
            const subtotal = inv.valorSinImpuestos || 0;
            const iva = inv.iva || 0;
            const total = inv.importeTotal || (subtotal + iva);
            const tarifa = inv.tarifaIva ?? (iva > 0 ? (Math.abs(iva / subtotal - 0.05) < 0.01 ? 5 : 15) : 0);

            totalBase += subtotal;
            totalIva += iva;
            totalGasto += total;

            if (tarifa === 0 || iva === 0) {
                base0 += subtotal;
            } else if (tarifa === 5) {
                base5 += subtotal;
                iva5 += iva;
            } else {
                // Tarifa plena 15%
                if (inv.tieneCreditoTributario) {
                    base15ConCredito += subtotal;
                    iva15ConCredito += iva;
                } else {
                    base15SinCredito += subtotal;
                    iva15SinCredito += iva;
                }
            }
        });

        const round = (val: number) => Math.round(val * 100) / 100;

        return {
            totalFacturas: invoices.length,
            base15ConCredito: round(base15ConCredito),
            iva15ConCredito: round(iva15ConCredito),
            base15SinCredito: round(base15SinCredito),
            iva15SinCredito: round(iva15SinCredito),
            base5: round(base5),
            iva5: round(iva5),
            base0: round(base0),
            totalBase: round(totalBase),
            totalIva: round(totalIva),
            totalGasto: round(totalGasto)
        };
    }

    /**
     * Carga las facturas de compras registradas para un cliente y período específico.
     * Si no hay facturas guardadas, devuelve una lista vacía y montos en cero.
     * NUNCA genera facturas demo ficticias ni mezcla datos de otros clientes.
     */
    static getClientPurchases(client: Client, period: string): ClientPurchasesAudit {
        const storageKey = `sc_compras_${client.ruc}_${period}`;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.invoices && Array.isArray(parsed.invoices)) {
                    // Detectar y purgar si son facturas demo ficticias generadas por el mock anterior
                    const isLegacyMock = parsed.invoices.length === 7 &&
                        parsed.invoices.every((i: any) => i.id?.startsWith(`inv-${client.ruc}-`)) &&
                        parsed.invoices.some((i: any) => i.rucEmisor === '1790010937001' && i.razonSocial?.includes('PICHINCHA'));

                    if (!isLegacyMock) {
                        return {
                            ...parsed,
                            summary: this.calculateSummary(parsed.invoices)
                        };
                    } else {
                        try {
                            localStorage.removeItem(storageKey);
                        } catch {}
                    }
                }
            }
        } catch (e) {
            console.warn('Error leyendo compras guardadas:', e);
        }

        // Si no hay facturas guardadas para este cliente y período, devolver estructura limpia
        const emptyAudit: ClientPurchasesAudit = {
            ruc: client.ruc,
            period,
            updatedAt: new Date().toISOString(),
            invoices: [],
            summary: {
                totalFacturas: 0,
                base15ConCredito: 0,
                iva15ConCredito: 0,
                base15SinCredito: 0,
                iva15SinCredito: 0,
                base5: 0,
                iva5: 0,
                base0: 0,
                totalBase: 0,
                totalIva: 0,
                totalGasto: 0
            }
        };

        return emptyAudit;
    }

    /**
     * Obtiene el arqueo de compras consolidado para el perfil del cliente.
     * Busca únicamente información correspondiente a ese cliente específico:
     * 1. Facturas detalladas del período (`sc_compras_${client.ruc}_${period}`)
     * 2. Resumen de compras del período (`sc_compras_resumen_${client.ruc}_${period}`)
     * 3. Arqueo reciente emitido por la extensión Nueva Luz 3.0 (`sc_compras_${client.ruc}`)
     * 4. Historial de declaraciones presentadas del cliente (`client.declarationHistory`)
     * 
     * Si no hay registros, devuelve un estado en cero verídico (sin mockups ni datos genéricos).
     */
    static getClientPurchasesSummary(client: Client, targetPeriod?: string): ClientPurchasesDisplayData {
        const now = new Date();
        let defaultMonth = now.getMonth() - 1;
        let defaultYear = now.getFullYear();
        if (defaultMonth < 0) { defaultMonth = 11; defaultYear--; }
        const period = targetPeriod || `${defaultYear}-${String(defaultMonth + 1).padStart(2, '0')}`;

        // 1. Verificar facturas detalladas del cliente para este período
        try {
            const audit = this.getClientPurchases(client, period);
            if (audit.invoices && audit.invoices.length > 0) {
                const s = audit.summary;
                const provMap = new Map<string, { nombre: string; ruc: string; monto: number; facturas: number }>();
                audit.invoices.forEach(inv => {
                    const key = inv.rucEmisor || inv.razonSocial;
                    const prev = provMap.get(key) || { nombre: inv.razonSocial, ruc: inv.rucEmisor, monto: 0, facturas: 0 };
                    prev.monto += inv.importeTotal || (inv.valorSinImpuestos + inv.iva);
                    prev.facturas += 1;
                    provMap.set(key, prev);
                });
                const topProviders = Array.from(provMap.values())
                    .sort((a, b) => b.monto - a.monto)
                    .slice(0, 3)
                    .map(p => ({
                        nombre: p.nombre,
                        ruc: p.ruc,
                        monto: Math.round(p.monto * 100) / 100,
                        facturas: p.facturas
                    }));

                return {
                    totalDocs: audit.invoices.length,
                    base15: s.base15ConCredito,
                    iva15: s.iva15ConCredito,
                    base15SinCredito: s.base15SinCredito,
                    iva15SinCredito: s.iva15SinCredito,
                    base5: s.base5,
                    iva5: s.iva5,
                    base0: s.base0,
                    totalBase: s.totalBase,
                    totalIva: s.totalIva,
                    topProviders,
                    hasData: true,
                    source: 'invoices'
                };
            }
        } catch {}

        // 2. Verificar resumen plano guardado para el período
        try {
            const rawResumen = localStorage.getItem(`sc_compras_resumen_${client.ruc}_${period}`);
            if (rawResumen) {
                const r = JSON.parse(rawResumen);
                if (r && (r.totalDocs > 0 || r.base15 > 0 || r.base5 > 0 || r.base0 > 0)) {
                    return {
                        totalDocs: r.totalDocs || 0,
                        base15: Number(r.base15 || 0),
                        iva15: Number(r.iva15 || 0),
                        base15SinCredito: Number(r.base15SinCredito || 0),
                        iva15SinCredito: Number(r.iva15SinCredito || 0),
                        base5: Number(r.base5 || 0),
                        iva5: Number(r.iva5 || 0),
                        base0: Number(r.base0 || 0),
                        totalBase: Number((r.base15 || 0) + (r.base15SinCredito || 0) + (r.base5 || 0) + (r.base0 || 0)),
                        totalIva: Number((r.iva15 || 0) + (r.iva15SinCredito || 0) + (r.iva5 || 0)),
                        topProviders: (r.topProviders || []).slice(0, 3),
                        hasData: true,
                        source: 'resumen'
                    };
                }
            }
        } catch {}

        // 3. Verificar arqueo de la extensión Nueva Luz 3.0 específico para este cliente
        try {
            const rawExt = localStorage.getItem(`sc_compras_${client.ruc}`);
            if (rawExt) {
                const ext = JSON.parse(rawExt);
                if (ext && ext.ruc === client.ruc && (ext.totalFacturas > 0 || ext.totalBase > 0)) {
                    return {
                        totalDocs: ext.totalFacturas || 0,
                        base15: Number(ext.base15 || 0),
                        iva15: Number(ext.iva15 || 0),
                        base15SinCredito: 0,
                        iva15SinCredito: 0,
                        base5: Number(ext.base5 || 0),
                        iva5: Number(ext.iva5 || 0),
                        base0: Number(ext.base0 || 0),
                        totalBase: Number(ext.totalBase || 0),
                        totalIva: Number(ext.totalIva || 0),
                        topProviders: (ext.topProveedores || []).map((p: any) => ({
                            nombre: p.nombre,
                            monto: p.total || p.monto || 0,
                            facturas: p.facturas
                        })),
                        hasData: true,
                        source: 'extension'
                    };
                }
            }
        } catch {}

        // 4. Verificar cifras en declaraciones del cliente (si existen para ese período)
        try {
            const dec = (client.declarations || []).find(d => d.period === period);
            const historyItem = (client as any).declarationHistory?.[period];
            const meta = dec?.proof_file?.metadata || historyItem?.metadata || historyItem?.cifras || historyItem;
            if (meta) {
                const compras15 = Number(meta.compras15 || 0);
                const compras5 = Number(meta.compras5 || 0);
                const compras0 = Number(meta.compras0 || 0);
                const montoIvaCompras = Number(meta.montoIvaCompras || (compras15 * 0.15 + compras5 * 0.05));

                if (compras15 > 0 || compras5 > 0 || compras0 > 0 || montoIvaCompras > 0) {
                    return {
                        totalDocs: 0,
                        base15: compras15,
                        iva15: montoIvaCompras,
                        base15SinCredito: 0,
                        iva15SinCredito: 0,
                        base5: compras5,
                        iva5: Math.round(compras5 * 0.05 * 100) / 100,
                        base0: compras0,
                        totalBase: Math.round((compras15 + compras5 + compras0) * 100) / 100,
                        totalIva: Math.round(montoIvaCompras * 100) / 100,
                        topProviders: [],
                        hasData: true,
                        source: 'declaration'
                    };
                }
            }
        } catch {}

        // 5. Estado verídico sin datos
        return {
            totalDocs: 0,
            base15: 0,
            iva15: 0,
            base15SinCredito: 0,
            iva15SinCredito: 0,
            base5: 0,
            iva5: 0,
            base0: 0,
            totalBase: 0,
            totalIva: 0,
            topProviders: [],
            hasData: false,
            source: 'none'
        };
    }

    /**
     * Guarda el arqueo de facturas con su clasificación para ese cliente y período.
     */
    static saveClientPurchases(audit: ClientPurchasesAudit): void {
        const storageKey = `sc_compras_${audit.ruc}_${audit.period}`;
        audit.summary = this.calculateSummary(audit.invoices);
        audit.updatedAt = new Date().toISOString();

        try {
            localStorage.setItem(storageKey, JSON.stringify(audit));

            // Sincronizar también el resumen plano que espera la barra de la extensión y el ProfileTab
            const flatSummary = {
                totalDocs: audit.summary.totalFacturas,
                base15: audit.summary.base15ConCredito,
                iva15: audit.summary.iva15ConCredito,
                base15SinCredito: audit.summary.base15SinCredito,
                iva15SinCredito: audit.summary.iva15SinCredito,
                base5: audit.summary.base5,
                iva5: audit.summary.iva5,
                base0: audit.summary.base0,
                topProviders: audit.invoices.slice(0, 4).map(i => ({
                    nombre: i.razonSocial,
                    ruc: i.rucEmisor,
                    monto: i.importeTotal
                }))
            };
            localStorage.setItem(`sc_compras_resumen_${audit.ruc}_${audit.period}`, JSON.stringify(flatSummary));
        } catch (e) {
            console.error('Error guardando compras de cliente:', e);
        }
    }
}
