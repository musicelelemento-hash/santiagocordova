/**
 * Marketing de SC Estrategias Fiscales (22-nov-2026). Pedido de Santiago:
 * tarjetas, volantes, anuncios y videos para Meta, y un camino medido hacia
 * 3.000 clientes de IVA mensual.
 *
 * Todo es lógica pura (sin red, sin pantalla) para poder probarlo en
 * tests/marketing.test.ts. Las pantallas de components/marketing/ sólo lo dibujan.
 *
 * Reglas de contenido:
 *  - Ningún dato del SRI que no esté verificado en la skill sri-ecuador
 *    (.claude/skills/sri-ecuador). La multa citada es la del Art. 100 LRTI.
 *  - Los costos de Meta son SUPUESTOS editables: Santiago los cambia por los
 *    reales del Administrador de anuncios. Nunca se presentan como precios de Meta.
 *  - Ningún mensaje se envía solo: todo es para copiar o descargar.
 */

// ── Marca ───────────────────────────────────────────────────────────────────

export const MARCA = {
    nombre: 'SC Estrategias Fiscales',
    persona: 'Santiago Córdova',
    cargo: 'Contador · Asesor tributario',
    whatsapp: '593978980722',
    telefonoVisible: '097 898 0722',
    direccion: 'Colón y Sucre · Pasaje, El Oro',
    web: 'santiagocordova.com',
    lema: 'Tus impuestos al día, sin filas ni multas.',
    colores: {
        obsidian: '#020617',
        navy: '#0F172A',
        azure: '#2B6AFF',
        violet: '#6366F1',
        emerald: '#04B17B',
        blanco: '#FFFFFF',
    },
} as const;

/**
 * Enlace de WhatsApp con un código de campaña al final del mensaje
 * (p. ej. «[IVA-M1]»). Cuando el cliente escribe, el código dice de qué
 * anuncio o volante vino: así se sabe qué funciona.
 */
export function enlaceWhatsApp(codigo: string, mensaje = 'Hola, quiero información sobre sus servicios'): string {
    const texto = codigo ? `${mensaje} [${codigo}]` : mensaje;
    return `https://wa.me/${MARCA.whatsapp}?text=${encodeURIComponent(texto)}`;
}

// ── Servicios y precios ─────────────────────────────────────────────────────

export type Servicio = 'iva_mensual' | 'iva_semestral' | 'renta' | 'firma' | 'facturacion';

export interface Tarifas {
    ivaMensual?: number;
    ivaSemestral?: number;
    rentaNP?: number;
    rentaGeneral?: number;
}

export interface FichaServicio {
    id: Servicio;
    nombre: string;
    /** Para quién es, en una línea. */
    paraQuien: string;
    /** Frase corta para el titular. */
    gancho: string;
    beneficios: string[];
    /** Código corto para el enlace de WhatsApp. */
    codigo: string;
}

export const SERVICIOS: Record<Servicio, FichaServicio> = {
    iva_mensual: {
        id: 'iva_mensual',
        nombre: 'Declaración de IVA mensual',
        paraQuien: 'Régimen General y quien declara IVA cada mes',
        gancho: 'Tu IVA de cada mes, declarado a tiempo',
        beneficios: ['Te avisamos antes de tu fecha (según el 9.º dígito de tu RUC)', 'Comprobante en tu WhatsApp', 'Sin filas ni claves perdidas'],
        codigo: 'IVA-M',
    },
    iva_semestral: {
        id: 'iva_semestral',
        nombre: 'Declaración de IVA semestral',
        paraQuien: 'RIMPE Emprendedor',
        gancho: 'Emprendedor RIMPE: tu IVA semestral sin sustos',
        beneficios: ['Primer semestre en julio, segundo en enero', 'Te recordamos con tiempo', 'Comprobante en tu WhatsApp'],
        codigo: 'IVA-S',
    },
    renta: {
        id: 'renta',
        nombre: 'Impuesto a la Renta anual',
        paraQuien: 'Personas naturales (General en marzo, RIMPE en mayo)',
        gancho: 'Tu declaración de Renta, revisada por un contador',
        beneficios: ['Gastos personales bien cargados', 'Fecha según tu régimen', 'Te explicamos qué pagas y por qué'],
        codigo: 'RENTA',
    },
    firma: {
        id: 'firma',
        nombre: 'Firma electrónica .p12',
        paraQuien: 'Quien necesita firmar o facturar electrónicamente',
        gancho: 'Tu firma electrónica, lista y en regla',
        beneficios: ['Trámite guiado', 'Te avisamos antes de que venza', 'Lista para facturar'],
        codigo: 'FIRMA',
    },
    facturacion: {
        id: 'facturacion',
        nombre: 'Facturación electrónica',
        paraQuien: 'Negocios que deben emitir facturas al SRI',
        gancho: 'Factura electrónica sin complicarte',
        beneficios: ['Sistema de facturación + firma', 'Te dejamos facturando', 'Soporte por WhatsApp'],
        codigo: 'FACT',
    },
};

/** Precio a mostrar (de Ajustes → tarifas). null = «consultar». */
export function precioDe(servicio: Servicio, tarifas: Tarifas | undefined): number | null {
    const t = tarifas || {};
    const v = servicio === 'iva_mensual' ? t.ivaMensual
        : servicio === 'iva_semestral' ? t.ivaSemestral
        : servicio === 'renta' ? t.rentaNP
        : null;
    return typeof v === 'number' && v > 0 ? v : null;
}

export function textoPrecio(servicio: Servicio, tarifas: Tarifas | undefined): string {
    const p = precioDe(servicio, tarifas);
    if (p === null) return 'Consulta tu precio';
    const sufijo = servicio === 'iva_mensual' ? ' al mes' : servicio === 'iva_semestral' ? ' por semestre' : servicio === 'renta' ? ' desde' : '';
    return servicio === 'renta' ? `Desde $${p}` : `$${p}${sufijo}`;
}

// ── Camino a la meta (calculadora) ──────────────────────────────────────────

export interface Supuestos {
    /** Clientes de IVA mensual hoy. */
    actuales: number;
    meta: number;
    meses: number;
    /** Costo por conversación iniciada en WhatsApp desde Meta (USD). SUPUESTO editable. */
    costoPorConversacion: number;
    /** De cada 100 conversaciones, cuántas terminan en cliente (0–1). */
    tasaCierre: number;
    /** Clientes que se van por mes (0–1). */
    bajaMensual: number;
    /** Honorario mensual promedio (USD). */
    honorario: number;
    /** Declaraciones que puede cerrar una persona en un día de vencimiento. */
    capacidadPorPersonaDia: number;
}

export interface Resultado {
    /** Clientes nuevos que hacen falta cada mes (incluye reponer los que se van). */
    nuevosPorMes: number;
    conversacionesPorMes: number;
    conversacionesPorDia: number;
    presupuestoMensual: number;
    presupuestoTotal: number;
    costoPorCliente: number;
    /** Meses de honorario para recuperar lo que costó conseguir un cliente. */
    mesesParaRecuperar: number;
    ingresoMensualAlLlegar: number;
    /** Al llegar a la meta: declaraciones en cada día de vencimiento (10 días, uno por 9.º dígito). */
    declaracionesPorDiaVencimiento: number;
    personasNecesarias: number;
    /** Avance de la meta hoy (0–100). */
    avance: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Cuántos clientes nuevos por mes hacen falta para pasar de `actuales` a `meta`
 * en `meses`, perdiendo `bajaMensual` cada mes. Crecimiento lineal de la base:
 * nuevos = (meta − actuales)/meses + baja sobre la base promedio del camino.
 */
export function calcularCamino(s: Supuestos): Resultado {
    const meses = Math.max(1, Math.round(s.meses));
    const falta = Math.max(0, s.meta - s.actuales);
    const basePromedio = (s.actuales + Math.max(s.actuales, s.meta)) / 2;
    const nuevosPorMes = Math.ceil(falta / meses + basePromedio * Math.max(0, s.bajaMensual));
    const cierre = Math.min(1, Math.max(0.001, s.tasaCierre));
    const conversacionesPorMes = Math.ceil(nuevosPorMes / cierre);
    const presupuestoMensual = r2(conversacionesPorMes * Math.max(0, s.costoPorConversacion));
    const costoPorCliente = r2(nuevosPorMes ? presupuestoMensual / nuevosPorMes : 0);
    const declaracionesPorDiaVencimiento = Math.ceil(s.meta / 10);
    return {
        nuevosPorMes,
        conversacionesPorMes,
        conversacionesPorDia: Math.ceil(conversacionesPorMes / 30),
        presupuestoMensual,
        presupuestoTotal: r2(presupuestoMensual * meses),
        costoPorCliente,
        mesesParaRecuperar: s.honorario > 0 ? r2(costoPorCliente / s.honorario) : 0,
        ingresoMensualAlLlegar: r2(s.meta * Math.max(0, s.honorario)),
        declaracionesPorDiaVencimiento,
        personasNecesarias: Math.ceil(declaracionesPorDiaVencimiento / Math.max(1, s.capacidadPorPersonaDia)),
        avance: s.meta > 0 ? Math.min(100, r2((s.actuales / s.meta) * 100)) : 0,
    };
}

/** Supuestos de arranque: cámbialos por tus datos reales. */
export const SUPUESTOS_INICIALES: Omit<Supuestos, 'actuales' | 'honorario'> = {
    meta: 3000,
    meses: 24,
    costoPorConversacion: 1,
    tasaCierre: 0.15,
    bajaMensual: 0.02,
    capacidadPorPersonaDia: 40,
};

// ── Calendario de publicaciones según el SRI ────────────────────────────────

/** Día de vencimiento por 9.º dígito: 1→10, 2→12 … 9→26, 0→28. */
export const DIA_POR_DIGITO: Record<number, number> = { 1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28 };

/** Sábado o domingo pasan al lunes (traslado al siguiente día hábil). Feriados: no incluidos. */
export function diaHabil(y: number, m: number, d: number): Date {
    const f = new Date(y, m, d);
    const dow = f.getDay();
    if (dow === 6) f.setDate(f.getDate() + 2);
    else if (dow === 0) f.setDate(f.getDate() + 1);
    return f;
}

export interface Publicacion {
    fecha: Date;
    titulo: string;
    texto: string;
    tipo: 'vencimiento' | 'recordatorio' | 'temporada' | 'confianza';
    codigo: string;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Publicaciones del mes (m = 0–11): una por cada día de vencimiento del IVA
 * mensual —el gancho que sólo un estudio contable tiene: «hoy vence para los
 * RUC con 9.º dígito X»—, más las de temporada (semestral, Renta).
 * Varios dígitos pueden caer el mismo día tras el traslado: se juntan.
 */
export function calendarioDelMes(y: number, m: number): Publicacion[] {
    const mesAnterior = MESES[(m + 11) % 12];
    const porDia = new Map<number, { fecha: Date; digitos: number[] }>();
    for (const dig of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
        const f = diaHabil(y, m, DIA_POR_DIGITO[dig]);
        const k = f.getTime();
        const e = porDia.get(k) || { fecha: f, digitos: [] };
        e.digitos.push(dig);
        porDia.set(k, e);
    }
    const out: Publicacion[] = [];

    out.push({
        fecha: new Date(y, m, 1),
        titulo: `Ya puedes declarar el IVA de ${mesAnterior}`,
        texto: `Arrancó el mes: el IVA de ${mesAnterior} vence entre el 10 y el 28 según el 9.º dígito de tu RUC. Escríbenos y te decimos tu fecha exacta.`,
        tipo: 'recordatorio',
        codigo: 'CAL-INICIO',
    });

    for (const { fecha, digitos } of Array.from(porDia.values()).sort((a, b) => a.fecha.getTime() - b.fecha.getTime())) {
        const lista = digitos.length === 1 ? `${digitos[0]}` : `${digitos.slice(0, -1).join(', ')} y ${digitos[digitos.length - 1]}`;
        out.push({
            fecha,
            titulo: `Hoy vence el IVA para RUC con 9.º dígito ${lista}`,
            texto: `¿Tu RUC tiene un ${lista} en la 9.ª posición? Hoy es tu último día para declarar el IVA de ${mesAnterior}. Declarar tarde cuesta un 3 % del impuesto por cada mes de retraso, más intereses. Te lo hacemos hoy: escríbenos.`,
            tipo: 'vencimiento',
            codigo: `CAL-D${digitos.join('')}`,
        });
    }

    // Temporada: semestral (julio y enero), Renta (marzo General, mayo RIMPE).
    if (m === 6 || m === 0) {
        const sem = m === 6 ? 'primer' : 'segundo';
        out.push({ fecha: new Date(y, m, 3), titulo: `RIMPE Emprendedor: toca el IVA del ${sem} semestre`, texto: `Este mes declaras el IVA del ${sem} semestre, en tu día según el 9.º dígito del RUC. ¿Lo hacemos juntos?`, tipo: 'temporada', codigo: 'CAL-SEM' });
    }
    if (m === 2) out.push({ fecha: new Date(y, m, 3), titulo: 'Renta: este mes declaran las personas del Régimen General', texto: 'En marzo vence la Renta de personas naturales del Régimen General, en tu día según el 9.º dígito. Revisamos tus gastos personales para que no pagues de más.', tipo: 'temporada', codigo: 'CAL-RENTA-G' });
    if (m === 4) out.push({ fecha: new Date(y, m, 3), titulo: 'Renta RIMPE: este mes es tu turno', texto: 'En mayo declaran la Renta las personas naturales del RIMPE (Emprendedor y Negocio Popular), en su día según el 9.º dígito. Te ayudamos.', tipo: 'temporada', codigo: 'CAL-RENTA-R' });

    out.push({
        fecha: new Date(y, m, 5),
        titulo: 'Un cliente al día no hace filas',
        texto: `Llevamos los impuestos de negocios de El Oro desde ${MARCA.direccion.split('·')[1]?.trim() || 'Pasaje'}. Te avisamos antes de tu fecha y te mandamos el comprobante por WhatsApp.`,
        tipo: 'confianza',
        codigo: 'CAL-CONF',
    });

    return out.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

/** «Declaración de IVA» → «declaración de IVA» (sólo la primera letra: las siglas quedan). */
const enMinuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

// ── Anuncios para Meta ──────────────────────────────────────────────────────

export type Angulo = 'fecha' | 'tranquilidad' | 'cercania';

export interface Anuncio {
    id: string;
    servicio: Servicio;
    angulo: Angulo;
    /** Texto principal (lo que va arriba de la imagen). */
    texto: string;
    /** Titular corto (≤ 40 caracteres). */
    titular: string;
    /** Botón sugerido en Meta. */
    boton: 'Enviar mensaje' | 'Más información';
    codigo: string;
    enlace: string;
}

export function anunciosPara(servicio: Servicio, tarifas?: Tarifas): Anuncio[] {
    const f = SERVICIOS[servicio];
    const precio = textoPrecio(servicio, tarifas);
    const base = (angulo: Angulo, n: number, titular: string, texto: string): Anuncio => {
        const codigo = `${f.codigo}${n}`;
        return { id: `${servicio}-${angulo}`, servicio, angulo, titular: titular.slice(0, 40), texto, boton: 'Enviar mensaje', codigo, enlace: enlaceWhatsApp(codigo) };
    };
    return [
        base('fecha', 1, f.gancho,
            `¿Sabes qué día vence tu declaración? Depende del 9.º dígito de tu RUC. Nosotros lo llevamos por ti y te avisamos antes.\n\n✅ ${f.beneficios.join('\n✅ ')}\n\n${precio}. Escríbenos por WhatsApp.`),
        base('tranquilidad', 2, 'Olvídate del SRI este mes',
            `Declarar tarde cuesta un 3 % del impuesto por cada mes de retraso, más intereses. Con ${MARCA.nombre} tu ${enMinuscula(f.nombre)} sale a tiempo y te llega el comprobante a tu WhatsApp.\n\n${precio}.`),
        base('cercania', 3, 'Tu contador en Pasaje, El Oro',
            `Atención presencial en ${MARCA.direccion} y por WhatsApp. ${f.paraQuien}: te explicamos todo en palabras simples.\n\n${precio}. Pregunta sin compromiso.`),
    ];
}

/** Públicos sugeridos para Meta. Son puntos de partida, no datos de Meta. */
export const PUBLICOS: { nombre: string; ubicacion: string; edad: string; intereses: string[]; para: Servicio[] }[] = [
    { nombre: 'Negocios de El Oro', ubicacion: 'Pasaje + Machala + Santa Rosa + El Guabo (radio 20 km)', edad: '25–60', intereses: ['Pequeña empresa', 'Emprendimiento', 'Comercio minorista'], para: ['iva_mensual', 'facturacion'] },
    { nombre: 'Emprendedores RIMPE', ubicacion: 'Provincia de El Oro', edad: '22–50', intereses: ['Emprendimiento', 'Ventas en línea', 'Tiendas'], para: ['iva_semestral', 'renta'] },
    { nombre: 'Profesionales independientes', ubicacion: 'El Oro y Azuay', edad: '25–55', intereses: ['Trabajo independiente', 'Salud', 'Construcción'], para: ['renta', 'firma', 'iva_mensual'] },
];

// ── Guiones de video (Reels / historias, 9:16) ──────────────────────────────

export interface Escena {
    desde: number;
    hasta: number;
    imagen: string;
    textoEnPantalla: string;
    voz: string;
}

export interface Guion {
    id: string;
    servicio: Servicio;
    titulo: string;
    segundos: number;
    escenas: Escena[];
    /** Prompt para un generador de video con IA (en inglés: suelen entenderlo mejor). */
    prompt: string;
    codigo: string;
}

export function guionesPara(servicio: Servicio): Guion[] {
    const f = SERVICIOS[servicio];
    const estilo = `Vertical 9:16, 15 seconds, cinematic, deep navy (#020617) background with electric blue (#2B6AFF) and emerald (#04B17B) accents, clean modern office in a small Ecuadorian coastal town, natural light, no logos of real companies, no readable fake text, Spanish-speaking Ecuadorian people.`;
    return [
        {
            id: `${servicio}-reloj`,
            servicio,
            titulo: 'El reloj del SRI',
            segundos: 15,
            codigo: `${f.codigo}V1`,
            escenas: [
                { desde: 0, hasta: 3, imagen: 'Primer plano de un calendario con el día 28 marcado en rojo; mano nerviosa.', textoEnPantalla: '¿Qué día vence tu IVA?', voz: '¿Sabes qué día vence tu declaración?' },
                { desde: 3, hasta: 8, imagen: 'Comerciante en su tienda mirando el celular, preocupado.', textoEnPantalla: 'Depende del 9.º dígito de tu RUC', voz: 'Depende del noveno dígito de tu RUC, y declarar tarde te cuesta.' },
                { desde: 8, hasta: 12, imagen: 'Le llega un WhatsApp con un comprobante; sonríe y respira.', textoEnPantalla: 'Te avisamos y lo declaramos', voz: 'Nosotros te avisamos antes y te mandamos el comprobante.' },
                { desde: 12, hasta: 15, imagen: `Tarjeta final con ${MARCA.nombre}, WhatsApp ${MARCA.telefonoVisible}.`, textoEnPantalla: `${MARCA.nombre} · ${MARCA.telefonoVisible}`, voz: 'Escríbenos por WhatsApp.' },
            ],
            prompt: `${estilo} Scene 1: close-up of a wall calendar with day 28 circled in red, a nervous hand taps it. Scene 2: a shop owner in a small Ecuadorian store looks worried at their phone. Scene 3: the phone receives a message with a PDF receipt, the owner smiles with relief. Scene 4: calm end card on navy background with an emerald glow, space left empty for text overlay.`,
        },
        {
            id: `${servicio}-antes-despues`,
            servicio,
            titulo: 'Antes y después',
            segundos: 15,
            codigo: `${f.codigo}V2`,
            escenas: [
                { desde: 0, hasta: 4, imagen: 'Escritorio lleno de facturas y papeles, luz fría.', textoEnPantalla: 'Antes: papeles, filas, claves perdidas', voz: 'Antes: papeles, filas y claves que nunca recuerdas.' },
                { desde: 4, hasta: 10, imagen: 'El mismo escritorio ordenado, laptop abierta con panel azul, luz cálida.', textoEnPantalla: 'Ahora: todo al día', voz: `Ahora: ${enMinuscula(f.nombre)} al día, sin que tengas que pensar en el SRI.` },
                { desde: 10, hasta: 15, imagen: 'Contador saludando a cámara en una oficina de Pasaje.', textoEnPantalla: f.gancho, voz: 'Escríbenos y empezamos este mes.' },
            ],
            prompt: `${estilo} Split transformation: first a messy desk covered in paper invoices under cold light, then the same desk tidy with an open laptop showing an abstract blue dashboard under warm light. End with a friendly accountant waving to camera in a modest office. Leave clean negative space for Spanish text overlays.`,
        },
    ];
}

// ── Piezas impresas ─────────────────────────────────────────────────────────

/** Medidas en píxeles para exportar a 300 ppp (impresión) o tamaño de red social. */
export const FORMATOS = {
    tarjeta: { nombre: 'Tarjeta de presentación (9 × 5 cm)', ancho: 1063, alto: 591 },
    volanteA5: { nombre: 'Volante A5 (14,8 × 21 cm)', ancho: 1748, alto: 2480 },
    post: { nombre: 'Publicación de Instagram/Facebook (4:5)', ancho: 1080, alto: 1350 },
    historia: { nombre: 'Historia o Reel (9:16)', ancho: 1080, alto: 1920 },
} as const;

export type Formato = keyof typeof FORMATOS;

// ── Medir: qué anuncio trae clientes ────────────────────────────────────────

/** Saca el código de campaña de un mensaje de WhatsApp: «… [IVA-M1]» → «IVA-M1». */
export function extraerCodigo(mensaje: string | undefined | null): string | null {
    const m = String(mensaje || '').toUpperCase().match(/\[([A-Z0-9][A-Z0-9-]{1,19})\]/);
    return m ? m[1] : null;
}

export interface FilaResultado {
    codigo: string;
    prospectos: number;
    ganados: number;
    /** Ganados / prospectos (0–1). */
    tasa: number;
}

/** Agrupa prospectos por código de campaña. Los sin código van al final como «Sin código». */
export function resultadosPorCodigo(leads: { codigoCampana?: string; etapa: string }[]): FilaResultado[] {
    const mapa = new Map<string, FilaResultado>();
    for (const l of leads || []) {
        const codigo = (l.codigoCampana || '').trim().toUpperCase() || 'Sin código';
        const f = mapa.get(codigo) || { codigo, prospectos: 0, ganados: 0, tasa: 0 };
        f.prospectos++;
        if (l.etapa === 'ganado') f.ganados++;
        mapa.set(codigo, f);
    }
    return Array.from(mapa.values())
        .map(f => ({ ...f, tasa: f.prospectos ? f.ganados / f.prospectos : 0 }))
        .sort((a, b) => (a.codigo === 'Sin código' ? 1 : b.codigo === 'Sin código' ? -1 : b.ganados - a.ganados || b.prospectos - a.prospectos));
}

// ── Responder rápido ────────────────────────────────────────────────────────

/**
 * Próximo vencimiento del IVA MENSUAL para un RUC/cédula: el de este mes si
 * todavía no pasó (hoy cuenta), si no el del mes siguiente. Fin de semana → lunes.
 * Devuelve null si el número no tiene 9.º dígito.
 */
export function proximoVencimientoIva(ruc: string, hoy: Date = new Date()): { fecha: Date; mesDeclarado: string; digito: number } | null {
    const limpio = String(ruc || '').replace(/\D/g, '');
    if (limpio.length < 9) return null;
    const digito = Number(limpio[8]);
    const y = hoy.getFullYear(), m = hoy.getMonth();
    const inicioHoy = new Date(y, m, hoy.getDate()).getTime();
    let fecha = diaHabil(y, m, DIA_POR_DIGITO[digito]);
    let mesDeclarado = MESES[(m + 11) % 12];
    if (fecha.getTime() < inicioHoy) {
        fecha = diaHabil(y, m + 1, DIA_POR_DIGITO[digito]);
        mesDeclarado = MESES[m];
    }
    return { fecha, mesDeclarado, digito };
}

export interface Respuesta {
    id: string;
    pregunta: string;
    texto: string;
}

/** Respuestas listas para las preguntas que más llegan por WhatsApp. */
export function respuestasRapidas(tarifas?: Tarifas): Respuesta[] {
    const pm = precioDe('iva_mensual', tarifas);
    const ps = precioDe('iva_semestral', tarifas);
    const precios = [
        pm !== null ? `IVA mensual: $${pm} al mes` : null,
        ps !== null ? `IVA semestral: $${ps} por semestre` : null,
    ].filter(Boolean).join('\n');
    return [
        {
            id: 'saludo',
            pregunta: 'Primer mensaje',
            texto: `¡Hola! Gracias por escribir a ${MARCA.nombre}. Soy ${MARCA.persona.split(' ')[0]}. ¿Me ayudas con tu RUC o cédula y te digo exactamente qué declaras y cuándo te vence?`,
        },
        {
            id: 'precio',
            pregunta: '¿Cuánto cuesta?',
            texto: `${precios || 'Te paso el precio según tu caso.'}\nIncluye: te avisamos antes de tu fecha, declaramos y te mandamos el comprobante por WhatsApp. Sin contratos largos.`,
        },
        {
            id: 'necesito',
            pregunta: '¿Qué necesito para empezar?',
            texto: 'Solo tres cosas: tu RUC, tu clave del SRI (la guardamos con cuidado) y tus facturas de compras y ventas del mes. Si no tienes la clave, te ayudamos a recuperarla.',
        },
        {
            id: 'confianza',
            pregunta: '¿Dónde están? ¿Es seguro?',
            texto: `Estamos en ${MARCA.direccion}. Puedes venir a la oficina o hacerlo todo por WhatsApp. Cada mes te llega el comprobante oficial del SRI para que veas que está hecho.`,
        },
        {
            id: 'cierre',
            pregunta: 'Cerrar',
            texto: '¿Empezamos este mes? Mándame tu RUC y te confirmo tu fecha y lo que vamos a declarar.',
        },
    ];
}

/** Respuesta a «¿cuándo me vence?» para un RUC concreto. */
export function respuestaVencimiento(ruc: string, hoy: Date = new Date()): string | null {
    const v = proximoVencimientoIva(ruc, hoy);
    if (!v) return null;
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const f = v.fecha;
    return `El 9.º dígito de tu RUC es ${v.digito}, así que tu IVA de ${v.mesDeclarado} vence el ${dias[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}. Con nosotros te avisamos antes y te mandamos el comprobante.`;
}
