# REBEFICS / APS · generador y esquema

El **REBEFICS** (Reporte de Beneficiarios Finales y Composición Societaria) se
presenta como anexo **APS** en XML comprimido, o por el formulario web del SRI.

En este proyecto ya hay **generador validado**: `tools/anexo_aps.mjs` reproduce
**byte a byte** el APS real que presentó el contador anterior de VIMARBO
(`APS-20-2-2026.xml`, 2025). Verificado con hash idéntico.

---

## 1 · Uso

```powershell
node "extenciones web/tools/anexo_aps.mjs" --json "empresa.json" --zip
```

Salida:

```
APS-2026-00.xml
Anexo_APS_<RUC>.zip
```

## 2 · Formato del JSON

```json
{
  "IdInformante": "0791844669001",
  "TipoSociedad": "01",
  "Anio": 2026,
  "Mes": 0,
  "Anticipada": "NO",
  "TipoDeclaracion": "01",
  "PortentajeAccionarioNoBolsa": "0.00",
  "accionistas": [
    {
      "tipoSujeto": "01",
      "tipoIdentificacion": "C",
      "numeroIdentificacion": "0704708718",
      "primerNombre": "BORIS ",
      "segundoNombre": "ANDRE",
      "primerApellido": "RODRIGUEZ ",
      "segundoApellido": "VALVERDE",
      "esBeneficiarioFinal": "SI",
      "infoParticipacionAccionaria": {
        "codigoNivel": "1",
        "tipoRelacionadoSociedad": "10",
        "porcentajeParticipacion": "51",
        "parteRelacionadaInformante": "SI"
      },
      "ubicacionResidenciaFiscal": { "paisResidenciaFiscal": "593" }
    }
  ],
  "beneficiarios": [
    {
      "tipoIdentificacion": "C",
      "numeroIdentificacion": "0704708718",
      "primerNombre": "BORIS ",
      "segundoNombre": "ANDRE",
      "primerApellido": "RODRIGUEZ ",
      "segundoApellido": "VALVERDE",
      "fechaNacimiento": "16/05/2001",
      "porPropiedad": "SI",
      "porcentajePropiedad": "51",
      "nacionalidadUno": "593",
      "residenciaFiscal": "593",
      "provincia": "107",
      "canton": "10709",
      "parroquia": "1070950",
      "codigoPostal": "070950"
    }
  ]
}
```

> Los nombres del ejemplo real traen **espacio final** (`"BORIS "`). El generador
> respeta lo que venga en el JSON: si copiás del SRI, mantené el texto tal cual.

## 3 · Estructura XML (orden exacto)

**Cabecera:** `TipoIDInformante` · `IdInformante` · `TipoSociedad` · `Anio` · `Mes`
(00) · `PorcentajeAccionarioNoBolsa` · `codigoOperativo` (APS) ·
`PorcentajeAccionarioBolsa` · `Anticipada` · `TipoDeclaracion` · `accionistas` ·
`beneficiarios`.

**Accionista:** 21 campos + `infoParticipacionAccionaria` (`codigoNivel`,
`tipoRelacionadoSociedad`, `porcentajeParticipacion`,
`parteRelacionadaInformante`) + `ubicacionResidenciaFiscal`.

**Beneficiario:** 26 campos, incluidos `fechaNacimiento`, `porcentajePropiedad`,
`porOtrosMotivos`, `nacionalidadUno/Dos/Tres`, y dirección completa
(`provincia`, `canton`, `parroquia`, `codigoPostal`, `calle`, `numero`,
`interseccion`, `referencia`).

## 4 · Datos observados en el APS de VIMARBO (2025)

| Accionista | C.I. | % | Beneficiario final | `tipoRelacionadoSociedad` |
|---|---|---|---|---|
| BORIS ANDRE RODRIGUEZ VALVERDE | 0704708718 | **51** | SI | 05 y 10 |
| KARLA VIVIANA INIGUEZ GARZON | 0750036220 | **49** | SI | 04 y 10 |

El SRI repite el accionista en dos entradas según la **figura de relación**
(`tipoRelacionadoSociedad`): una por la participación y otra por la relación
familiar/societaria. El generador respeta el arreglo que se le pase: si el cliente
tiene dos entradas, se incluyen las dos.

**Pendiente:** confirmar el **catálogo oficial de `tipoRelacionadoSociedad`** con la
ficha técnica (`Catálogo REBEFICS.xls` viene en formato antiguo y no se pudo leer
desde el sistema). Mientras tanto se usan los códigos observados en el archivo real.

## 5 · Plazos

- **Régimen general:** 10 al 28 de febrero, según el 9.º dígito del RUC.
- **Sociedad nueva o cambio de composición:** hasta el **28 del mes siguiente**.
- Si el vencimiento cae feriado, pasa al siguiente día hábil.

## 6 · Lo que falta para la web

1. Guardar socios y beneficiarios en la ficha de la empresa
   (`tax_profile.company = { accionistas, beneficiarios }`).
2. Botón **“Descargar APS”** en el panel de la empresa (mismo patrón que el Anexo ICE).
3. Validación previa: cédulas de 10 dígitos, porcentajes que sumen 100, fechas válidas.
4. Subida automática por la extensión al sistema de anexos (mismo patrón del ICE).
