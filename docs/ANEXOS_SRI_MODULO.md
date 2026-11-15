# Módulo de Anexos del SRI · mapa desde el recorrido Burp

Fuente: `_EVIDENCIA_SRI/RECORRIDO DE TODOS ANEXO` (export de Burp, 377 ítems,
15-nov-2026). Recorrido por **Anexos → Envío y consulta de anexos** con todos los tipos.

---

## 1 · Cómo se navega a un anexo

El portal no usa una página fija: **cada anexo entra por el parámetro `codOperativo`**
del menú operativo:

```
https://srienlinea.sri.gob.ec/rig/pages/menuInicial.xhtml
    ?codOperativo=<CODE>
    &contextoMPT=https://srienlinea.sri.gob.ec/tuportal-internet
    &pathMPT=
    &actualMPT=<Nombre del anexo, URL-encoded>
```

Después del SSO (`/auth/realms/Internet/protocol/openid-connect/auth?client_id=app-…`)
redirige al sistema de cada anexo:

| Sistema | Uso |
|---|---|
| `/rig/pages/menuInicial.xhtml` | Anexos servidos por el **RIG** (ATS, APS, ADI, ICE, PVP, IBP, …) |
| `/rigWeb/ice/seleccionMenu.jspa?action=<ACC>` | Anexos del **rigWeb** (MID, RDP, REO, PTF, ANR, DPT, GPR) |
| `/sri-anexo-crs-web-internet/pages/inicio-seguridad.jsf` | Anexo **CRS** (app aparte, PrimeFaces 13) |
| `/rigWeb/gpr/consultaGeneralAnexos.jspa` | **Consulta general** de anexos presentados |

> El token del menú se pide a `sri-menu-portal-servicio-internet/rest/menu/porTipo` y
> `…/rest/menu/privado/principal`; el SSO usa `client_id=app-rig-anexos`.

## 2 · Códigos `codOperativo` → anexo

| `codOperativo` | Anexo | Para VIMARBO |
|---|---|---|
| **IVA** | **Anexo Transaccional Simplificado (ATS)** | ✅ mensual |
| **APS** | **Reporte de Beneficiarios Finales y Composición Societaria (REBEFICS)** | ✅ anual |
| **ADI** | **Anexo de Dividendos, Utilidades o Beneficios** | ✅ anual |
| ICE | Anexo a los Consumos Especiales | — |
| PVP | Anexo Reporte de Precios de Venta | — |
| IBP | Anexo Impuesto Redimible a las Botellas Plásticas no Retornables | — |
| RTF | Anexo Reporte de Operaciones y Transacciones Económicas Financieras | — |
| ACA | Anexo de Cálculo Actuarial | — |
| ABT | Anexo de Incentivos y Beneficios Tributarios | — |
| AFI | Anexo de Fideicomisos Mercantiles, Fondos de Inversión y Complementarios | — |
| AMX | Anexo de Activos Monetarios en el Exterior | — |
| ASW | Anexo SWIFT | — |
| GAD | Anexo Reporte de Bienes Inmuebles y Espectáculos Públicos | — |

### Anexos del rigWeb (`seleccionMenu.jspa?action=`)

| action | Anexo |
|---|---|
| MID | Anexo Movimiento Internacional de Divisas |
| RDP | Anexo de Retenciones en la Fuente Bajo Relación de Dependencia |
| REO | Anexo de Retenciones en la Fuente de Renta por Otros Conceptos |
| PTF | Anexo de Operaciones con Partes Relacionadas del Exterior |
| ANR | Anexo de Notarios y Registradores de la Propiedad y Mercantiles |
| DPT | Declaración Patrimonial |
| GPR | Anexo de Gastos Personales DIMM |

## 3 · Nombres de `actualMPT`

```
Anexo%20Transaccional%20Simplificado
Reporte%20de%20Beneficiarios%20Finales%20y%20de%20Composici%C3%B3n%20Societaria
Anexo%20de%20Dividendos
```

## 4 · Nombre y formato del archivo (de las fichas técnicas)

| Anexo | Archivo | Formato |
|---|---|---|
| ATS | `Anexo_IVA_<n>.zip` (el SRI lo nombra así al descargarlo) | XML `<iva>` dentro de ZIP |
| REBEFICS / APS | `Anexo_APS_<n>.zip` | XML `<aps>` dentro de ZIP |
| ADI | **`ADI-aaaa.zip`** | XML dentro de ZIP (máx. 8 MB) |

## 5 · Lo que el recorrido no trae (y por qué)

En el export **no hay ninguna request `multipart/form-data`**: el recorrido fue de
navegación/consulta, **sin subir ningún archivo**. Por eso el formulario interno de
carga (ids del `fileUpload`, botón `Cargar`, `Aceptar`) todavía no está mapeado.

**Cómo completarlo sin Burp:** la extensión ya trae el botón **🧭 (Mapear Anexos)**.
Estando en la pantalla de carga de un anexo, ese botón copia inputs de archivo,
botones, selects, formularios y mensajes. Con ese JSON se cierra la automatización
de la subida.

## 6 · Lo que ya implementa la extensión con este mapa

- Abrir **directo** el anexo correcto por `codOperativo` (ATS/APS/ADI) con el nombre
  de `actualMPT` ya resuelto.
- Guardar el mapa en `docs` para no volver a investigarlo.
- El botón 🧭 sigue disponible para la captura del formulario de carga.
