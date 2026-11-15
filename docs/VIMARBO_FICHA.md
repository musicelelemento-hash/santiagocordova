# VIMARBO COMPANY S.A.S. · ficha real (leída de los certificados del SRI)

Datos extraídos del **certificado de RUC** y del **certificado de establecimiento**
que están en `RECURSOS PARA COMPANIAS O SOC` (además de los ATS/APS presentados).

---

## 1 · Identificación

| Dato | Valor |
|---|---|
| Razón social | **VIMARBO COMPANY S.A.S.** |
| RUC | **0791844669001** |
| Tipo | **SOCIEDAD** (3.er dígito = 9) · S.A.S. |
| Estado | ACTIVO |
| Régimen | **GENERAL** |
| Obligado a llevar contabilidad | **SÍ** |
| Agente de retención | **NO** |
| Contribuyente especial | **NO** |
| Fecha de constitución | **06/08/2025** |
| Inicio de actividades | 06/08/2025 |
| Fecha de actualización | 26/08/2025 |
| Jurisdicción | ZONA 7 / EL ORO / PASAJE |
| Código de verificación | RCR1794753519557496 (emitido 15/11/2026) |

**Representantes legales:**

- **IÑIGUEZ GARZON KARLA VIVIANA**
- **RODRIGUEZ VALVERDE BORIS ANDRE**

## 2 · Domicilio tributario y establecimientos

- Dirección matriz: **Barrio UN SOLO TOQUE · Calle ROCAFUERTE · Nro. SN · Intersección QUITO**
- Referencia: junto a la Cooperativa de Taxis Ejecutivos
- Parroquia: **OCHOA LEÓN (MATRIZ)** · Cantón: **PASAJE** · Provincia: **EL ORO**
- Establecimientos: **1 abierto** (matriz, tipo OFICINA, lugar OFICINA)
- Medios de contacto: *no registra*

## 3 · Actividades económicas

| Código | Actividad |
|---|---|
| **G461009** | INTERMEDIARIOS DEL COMERCIO DE PRODUCTOS DIVERSOS |
| **G475903** | VENTA AL POR MENOR DE UTENSILIOS DE USO DOMÉSTICO, CUBIERTOS, VAJILLA, CRISTALERÍA, PLÁSTICOS Y OBJETOS DE PORCELANA Y DE CERÁMICA EN ESTABLECIMIENTOS ESPECIALIZADOS |

> La actividad principal es **comercio al por menor de artículos de cocina/cerámica**
> (G475903). Sirve para clasificar compras y para el ATS.

## 4 · Obligaciones que el propio RUC lista

| Obligación | Periodicidad | Presente en el RUC |
|---|---|---|
| 2011 · Declaración de IVA | mensual | ✅ |
| 1021 · Renta Sociedades | anual | ✅ |
| Anexo Transaccional Simplificado (ATS) | mensual | ✅ |
| REBEFICS (beneficiarios finales) | anual | ✅ |
| **ADI · Anexo de Dividendos** | anual | ✅ |

**Consecuencia para el sistema:** el ADI aparece **siempre** como obligación de una
sociedad (el RUC lo lista aunque no reparta utilidades). Se muestra y se registra
con o sin movimiento.

## 5 · Fechas de presentación (9.º dígito = 4 → día 16)

| Obligación | Vence |
|---|---|
| IVA 2011 | día **16** del mes siguiente |
| ATS | día **16** del mes siguiente |
| REBEFICS | **febrero 2027** (la primera, 2025, ya se presentó) |
| 1021 Renta | **16 de abril** (ejercicio anterior) |
| ADI | **16 de mayo** |
| Contribuyente especial | **NO** (por eso el día normal, no el 11) |

## 6 · Datos societarios (del APS presentado)

| Socio | C.I. | % | Beneficiario final |
|---|---|---|---|
| BORIS ANDRE RODRIGUEZ VALVERDE | 0704708718 | **51 %** | Sí |
| KARLA VIVIANA IÑIGUEZ GARZON | 0750036220 | **49 %** | Sí |

- Los dos son **representantes legales** según el RUC.
- Nacimientos: BORIS 16/05/2001 · KARLA 14/08/1997 (del APS 2025).
- Domicilio de los beneficiarios: provincia 107, cantón 10709, parroquia 1070950, CP 070950.

## 7 · Trato comercial: USD 40 «todo incluido»

Oferta acordada: **$40 al mes por todo** el servicio de la compañía.

| Concepto | Incluido |
|---|---|
| Declaración de IVA mensual (2011) | ✅ |
| Anexo Transaccional Simplificado mensual (ATS) | ✅ |
| REBEFICS anual (APS) | ✅ |
| Declaración de Renta Sociedades anual (1021) | ✅ |
| Anexo de Dividendos anual (ADI) | ✅ |
| Facturación electrónica / emisión | ✅ |
| Notificaciones y recordatorios de vencimientos | ✅ |

**Cómo queda configurado en la plataforma** al dar de alta:

```
entity_type: sociedad            regime: General
ivaFrequency: Mensual            requiresAnnualRenta: true
clientFeeStructure.monthly: 40   (plan mensual, sin cargos aparte)
company.constitutionDate: 2025-08-06
company.accionistas: BORIS 51 % · KARLA 49 %
company.beneficiarios: los dos
```

**Ejecución normal del servicio (lo que debe ver el cliente):**

1. Día 1–5: se extraen compras/ventas del mes desde el portal.
2. IVA 2011: se arma y presenta antes del **16**.
3. ATS: se genera el XML+ZIP y se sube el mismo mes.
4. Febrero: REBEFICS (APS). Abril: 1021 Renta. Mayo: ADI.
5. Cada presentación deja comprobante en la bóveda y se le avisa por el bot.

## 8 · Lo que ya está cargado/validado con estos archivos

- **7 ATS reales** (enero–julio 2026) → generador validado **byte a byte**.
- **1 APS real** (2025) → generador validado **byte a byte**.
- **3 certificados de RUC/establecimiento** → datos de esta ficha.
- **2 declaraciones sin valor a pagar** (Renta 2025 e IVA) → confirman que el año
  anterior se presentó en cero.

## 9 · Pendiente para la carga del cliente

1. Cargar la empresa con estos datos (el RUC del certificado ya trae todo).
2. Cargar socios en **Editar socios** (51 % / 49 %) para generar el APS.
3. Marcar `monthly: 40` en la estructura de honorarios.
4. La primera extracción de compras habilitará el **Generar ATS** del mes.
