# Guía de Conceptos del Esquema de Base de Datos (Tabla: `clients`)

Esta guía define el concepto, formato y propósito de cada columna en la tabla `clients` de Supabase, facilitando la interpretación tanto para el sistema como para la IA (**Baku**).

## Campos Principales e Identificación

| Columna | Tipo de Dato | Concepto / Descripción |
| :--- | :--- | :--- |
| `id` | `uuid` | Identificador único global autogenerado del cliente. |
| `ruc` | `text` | Registro Único de Contribuyentes (13 dígitos). Clave primaria de negocio. |
| `name` | `text` | Nombre completo o Razón Social oficial del contribuyente. |
| `trade_name` | `text` | Nombre Comercial o de fantasía del establecimiento (opcional). |
| `economic_activity` | `text` | Actividad económica principal del contribuyente ante el SRI. |

## Credenciales y Accesos

> [!IMPORTANT]
> Los campos de contraseña y accesos en el bot utilizan un mapeo de traducción para compatibilidad entre el código heredado (`camelCase`) y la base de datos PostgreSQL (`snake_case`).

| Columna en BD | Variable en Bot | Etiqueta / Propósito |
| :--- | :--- | :--- |
| `sri_password` | `sri_password` | **Clave SRI**: Clave de acceso al portal del Servicio de Rentas Internas. |
| `iess_password` | `iessPassword` | **Clave IESS**: Clave patronal o personal para el portal del IESS. |
| `signature_password` | `electronicSignaturePassword` | **Clave Firma**: Contraseña para firmar comprobantes digitales. |
| `signature_expiration` | `signatureExpirationDate` | **Caducidad Firma**: Fecha en que expira el certificado de firma electrónica. |

## Contacto y Ubicación

| Columna | Tipo de Dato | Concepto / Descripción |
| :--- | :--- | :--- |
| `phones` | `jsonb` | Matriz de números telefónicos del cliente (ej: `["0999999999"]`). |
| `email` | `text` | Correo electrónico principal para notificaciones y facturación. |
| `address` | `text` | Dirección física de los locales o domicilio fiscal. |
| `notes` | `text` | Observaciones generales o notas escritas por el contador. |

## Perfil Fiscal y Honorarios

| Columna | Tipo de Dato | Concepto / Descripción |
| :--- | :--- | :--- |
| `regime` | `text` | Régimen fiscal: `'Régimen General'`, `'Rimpe Emprendedor'`, o `'Rimpe Negocio Popular'`. |
| `tax_profile` | `jsonb` | Perfil de obligaciones: `{ ivaFrequency: 'Mensual'\|'Semestral'\|'Ninguno', requiresAnnualRenta: boolean, requiresIce: boolean }`. |
| `fee_structure` | `jsonb` | Honorarios acordados: `{ monthly: number, semestral: number, annual: number }`. |
| `is_vip` | `boolean` | Flag para indicar si el cliente recibe atención prioritaria. |
| `is_active` | `boolean` | Estado del cliente: activo o inactivo comercialmente. |
| `is_deleted` | `boolean` | Borrado lógico: `true` si el expediente fue eliminado. |

## Historial y Seguimiento Operativo

| Columna | Tipo de Dato | Concepto / Descripción |
| :--- | :--- | :--- |
| `declaration_history` | `jsonb` | Matriz de declaraciones realizadas o pendientes. Cada elemento tiene el formato:<br>`{ type: 'IVA'\|'RENTA', period: 'YYYY-MM'\|'YYYY-1S'\|'YYYY', status: 'Pendiente'\|'Enviada'\|'Pagada', is_paid: boolean, paid_at: string, declaredAt: string, proof_file: object }` |

---

## Mapeo Automatizado del Bot

El archivo [database_ops.ts](file:///c:/Users/Santiago/Documents/Visual%20Code%20Antigraviti/01_Proyectos_Principales/SantiagoCordova.com/telegram-bot/src/database_ops.ts) realiza la traducción de manera transparente al leer y escribir campos individuales, asegurando que la IA siempre use etiquetas consistentes.
