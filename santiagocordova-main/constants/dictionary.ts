
export const UI_TEXT = {
    global: {
        appName: "SC Pro",
        loading: "Cargando...",
        processing: "Procesando...",
        save: "Guardar",
        cancel: "Cancelar",
        edit: "Editar",
        delete: "Eliminar",
        back: "Volver",
        close: "Cerrar",
        searchPlaceholder: "Buscar...",
        copy: "Copiar",
        print: "Imprimir",
        actions: "Acciones",
        active: "Activo",
        inactive: "Inactivo",
        error: "Error",
        success: "Éxito",
        whatsapp: "WhatsApp",
        email: "Email",
        phone: "Teléfono",
    },
    home: {
        dashboardTitle: "Panel de Control",
        dashboardSubtitle: "Resumen operativo en tiempo real",
        systemStatus: "Sistema Operativo",
        stats: {
            monthlyIncome: "Ingreso Mensual Fijo",
            monthlyTrend: "Proyección Suscripciones",
            vipAttention: "Atención VIP Requerida",
            vipTrend: "Clientes Suscritos Pendientes",
            activePortfolio: "Cartera Activa",
            activeTrend: "Clientes Habilitados"
        },
        sections: {
            vip: "Gestión VIP (Suscripciones)",
            operational: "Gestión Operativa",
            punctual: "Trámites Puntuales"
        },
        cards: {
            vipMonthly: { title: "Suscripción Mensual", desc: "Gestión prioritaria de IVA mensual para clientes VIP." },
            vipSemestral: { title: "Suscripción Semestral", desc: "Control semestral recurrente para clientes preferenciales." },
            internalMonthly: { title: "Interno Mensual", desc: "Declaraciones bajo demanda (Aviso del cliente)." },
            internalSemestral: { title: "Interno Semestral", desc: "Gestión semestral estándar." },
            rentaRimpe: { title: "Renta Negocio Popular", desc: "Declaración anual cuota fija RIMPE." },
            rentaGeneral: { title: "Impuesto a la Renta", desc: "Régimen General y Emprendedor." },
            refundElderly: { title: "Devolución IVA 3ra Edad", desc: "Gestión de devoluciones para adultos mayores." },
            refundRenta: "Devolución Retenciones",
            annexExpenses: "Anexo Gastos Personales"
        }
    },
    clients: {
        title: "Clientes",
        newClientBtn: "Nuevo Cliente",
        allClients: "Todos los Clientes",
        filterTitlePrefix: "Filtrado por:",
        quickActions: "Acciones Rápidas",
        noHistory: "Sin historial reciente",
        form: {
            titleNew: "Agregar Nuevo Cliente",
            titleEdit: "Editar Cliente",
            smartImportTitle: "Auto-completar con Imagen",
            smartImportDesc: "Arrastra o toca para subir foto del RUC/Cédula",
            sectionIdentity: "Identificación",
            sectionTax: "Tributario & Contacto",
            labelType: "Tipo",
            labelId: "Número de Identificación",
            placeholderIdRuc: "1790000000001",
            placeholderIdCedula: "1700000000",
            labelName: "Nombre / Razón Social",
            placeholderName: "Ej: Juan Pérez",
            labelSriPassword: "Clave SRI",
            labelRegime: "Régimen",
            labelCategory: "Categoría / Obligación",
            labelActivity: "Actividad Económica",
            placeholderActivity: "Ej: VENTA DE COMIDAS...",
            labelAddress: "Dirección Fiscal",
            placeholderAddress: "Calle Principal y Secundaria",
            labelPhone: "Teléfono Móvil",
            labelEmail: "Correo Electrónico",
            labelNotes: "Notas Internas",
            btnCreate: "Guardar Nuevo Cliente",
            btnUpdate: "Guardar Cambios",
            analyzing: "Analizando Documento con IA...",
            foundData: "Datos encontrados en SRI."
        },
        filters: {
            all: "Todos",
            paid: "Al Día",
            declared: "Declarado",
            pending: "Pendiente",
            overdue: "Vencido",
            active: "Activos",
            inactive: "Inactivos",
            advanced: "Filtros",
            status: "Estado Cliente",
            regime: "Régimen",
            obligation: "Obligaciones"
        },
        tabs: {
            overview: "Resumen",
            profile: "Perfil y Datos",
            history: "Historial"
        }
    },
    validation: {
        required: "Este campo es obligatorio.",
        invalidRuc: "RUC inválido.",
        invalidEmail: "Email inválido.",
        passWeak: "La clave no cumple los requisitos."
    }
};
