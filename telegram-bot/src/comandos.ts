// Los comandos que Baku publica en Telegram (autocompletado al tipear "/") y los
// únicos que un botón personalizado de la web puede disparar. Quedan afuera a
// propósito los de configuración y claves.
// La web valida contra la misma lista: screens/TelegramBotScreen.tsx → BAKU_COMMANDS.
export const COMANDOS_MENU: { command: string; description: string }[] = [
    { command: 'menu', description: 'Menú principal' },
    { command: 'hoy', description: 'Parte del día: qué vence y qué falta' },
    { command: 'clientes', description: 'Tus clientes con botones: por letra, dígito o tipo' },
    { command: 'semana', description: 'Resumen de la semana: cobros, clientes nuevos y anuncios' },
    { command: 'pendientes', description: 'Tus pendientes anotados' },
    { command: 'anota', description: 'Anotar un pendiente (ej.: /anota mañana 10am llamar al SRI)' },
    { command: 'cierre', description: 'Cierre del período: declarado × cobrado' },
    { command: 'cobranza', description: 'Deudores y cartera pendiente' },
    { command: 'lunes', description: 'Proponer la cobranza semanal por correo' },
    { command: 'vencimientos', description: 'Próximos vencimientos SRI' },
    { command: 'claves', description: 'Claves SRI faltantes o inválidas' },
    { command: 'comprobantes', description: 'Comprobantes de declaración de un cliente' },
    { command: 'firmas', description: 'Bóveda de firmas .p12' },
    { command: 'gestion', description: 'Gestión interna y alertas' },
    { command: 'reporte', description: 'Reporte operativo del día' },
    { command: 'resumen', description: 'Resumen de la base de datos' },
    { command: 'facturar', description: 'Emitir factura SRI' },
    { command: 'facturadores', description: 'Software de facturación de clientes' },
    { command: 'credenciales', description: 'Credenciales de facturadores' },
    { command: 'llenado', description: 'Llenado de facturas' },
    { command: 'renovaciones', description: 'Renovaciones de planes' },
    { command: 'status', description: 'Estado del bot' },
    { command: 'clear', description: 'Borrar la memoria del chat' },
];
