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
     * Carga o genera las facturas de compras para un cliente y período.
     */
    static getClientPurchases(client: Client, period: string): ClientPurchasesAudit {
        const storageKey = `sc_compras_${client.ruc}_${period}`;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.invoices && Array.isArray(parsed.invoices)) {
                    return {
                        ...parsed,
                        summary: this.calculateSummary(parsed.invoices)
                    };
                }
            }
        } catch (e) {
            console.warn('Error leyendo compras guardadas:', e);
        }

        // Si no hay detalle guardado, intentar leer resumen del arqueo previo o generar facturas iniciales
        let storedArqueo: any = null;
        try {
            const rawArqueo = localStorage.getItem(`sc_compras_${client.ruc}`);
            if (rawArqueo) storedArqueo = JSON.parse(rawArqueo);
        } catch {}

        const clientActivity = client.economicActivity || client.taxProfile?.economicActivity || 'servicios_profesionales';
        const catalog = this.getCatalog();

        // Generar facturas demo / reales inteligentes basadas en los top proveedores o actividad
        const initialInvoices: PurchaseInvoiceItem[] = [
            {
                id: `inv-${client.ruc}-1`,
                numero: 1,
                secuencial: '001-010-000189234',
                fechaEmision: `${period}-04`,
                rucEmisor: '1790010937001',
                razonSocial: 'BANCO PICHINCHA C.A.',
                categoria: 'bancos_financiero',
                valorSinImpuestos: 35.50,
                iva: 5.33,
                importeTotal: 40.83,
                tieneCreditoTributario: true,
                tarifaIva: 15
            },
            {
                id: `inv-${client.ruc}-2`,
                numero: 2,
                secuencial: '002-100-000543210',
                fechaEmision: `${period}-08`,
                rucEmisor: '1791256115001',
                razonSocial: 'CONECEL S.A. (CLARO)',
                categoria: 'telecomunicaciones',
                valorSinImpuestos: 45.00,
                iva: 6.75,
                importeTotal: 51.75,
                tieneCreditoTributario: true,
                tarifaIva: 15
            },
            {
                id: `inv-${client.ruc}-3`,
                numero: 3,
                secuencial: '001-005-000781290',
                fechaEmision: `${period}-12`,
                rucEmisor: '1790016919001',
                razonSocial: 'CORPORACION FAVORITA C.A. (SUPERMAXI)',
                categoria: 'supermercados_alimentos',
                valorSinImpuestos: 185.40,
                iva: 27.81,
                importeTotal: 213.21,
                tieneCreditoTributario: clientActivity === 'gastronomia', // Por defecto Sin Crédito Tributario para servicios/transporte
                tarifaIva: 15
            },
            {
                id: `inv-${client.ruc}-4`,
                numero: 4,
                secuencial: '004-001-000045612',
                fechaEmision: `${period}-15`,
                rucEmisor: '1791715845001',
                razonSocial: 'FARMAENLACE CIA. LTDA. (FARMACIAS ECONOMICAS)',
                categoria: 'salud_farmacia',
                valorSinImpuestos: 28.50,
                iva: 4.28,
                importeTotal: 32.78,
                tieneCreditoTributario: false, // Medicinas / salud personal
                tarifaIva: 15
            },
            {
                id: `inv-${client.ruc}-5`,
                numero: 5,
                secuencial: '001-002-000012948',
                fechaEmision: `${period}-18`,
                rucEmisor: '1791789725001',
                razonSocial: 'PRIMAX COMERCIAL DEL ECUADOR S.A.',
                categoria: 'combustibles_transporte',
                valorSinImpuestos: 65.00,
                iva: 9.75,
                importeTotal: 74.75,
                tieneCreditoTributario: clientActivity === 'transporte' || clientActivity === 'comercio' || clientActivity === 'agropecuario',
                tarifaIva: 15
            },
            {
                id: `inv-${client.ruc}-6`,
                numero: 6,
                secuencial: '001-001-000098172',
                fechaEmision: `${period}-22`,
                rucEmisor: '0791726354001',
                razonSocial: 'FERRETERIA EL ORO S.A.',
                categoria: 'ferreteria_construccion',
                valorSinImpuestos: 120.00,
                iva: 6.00,
                importeTotal: 126.00,
                tieneCreditoTributario: true,
                tarifaIva: 5 // Materiales tarifa 5%
            },
            {
                id: `inv-${client.ruc}-7`,
                numero: 7,
                secuencial: '001-002-000054321',
                fechaEmision: `${period}-25`,
                rucEmisor: '0968599020001',
                razonSocial: 'CNEL EP (ENERGIA ELECTRICA)',
                categoria: 'servicios_basicos',
                valorSinImpuestos: 42.00,
                iva: 0.00,
                importeTotal: 42.00,
                tieneCreditoTributario: false,
                tarifaIva: 0 // Tarifa 0%
            }
        ];

        const summary = this.calculateSummary(initialInvoices);
        const audit: ClientPurchasesAudit = {
            ruc: client.ruc,
            period,
            updatedAt: new Date().toISOString(),
            invoices: initialInvoices,
            summary
        };

        try {
            localStorage.setItem(storageKey, JSON.stringify(audit));
        } catch {}

        return audit;
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
