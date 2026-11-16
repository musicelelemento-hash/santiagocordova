# Cumplimiento con la Superintendencia de Compañías (SCVS) · informe para implementar

**Fecha:** 16-nov-2026 · **Alcance:** sociedades bajo control de la SCVS (incluye **S.A.S.**).
Complementa `INFORME_SOCIEDADES_SAS.md` (SRI) y `REBEFICS_APS.md`.

---

## 1 · Resumen ejecutivo

- Toda sociedad (S.A., Cía. Ltda., **S.A.S.**, sucursales) reporta **dos pistas en paralelo**:
  **SRI** (impuestos) y **SCVS** (gobierno societario). Nuestro sistema ya cubre SRI; SCVS
  estaba fuera de la matriz.
- La SCVS exige un **paquete anual** que vence el **30 de abril** del año siguiente al ejercicio:
  estados financieros firmados, **actas de junta** que los aprueban, **nómina de socios** e
  informe de auditor cuando aplica ([Commenda](https://www.commenda.io/ecuador/annual-compliance)).
- La **información de socios extranjeros** tiene fecha propia: **último día de febrero** de cada
  año, con nómina certificada ante notario, certificado de existencia legal y poder apostillado
  ([SCVS, 25-feb-2026](https://www.supercias.gob.ec/portalscvs/Noticias/Noticias.php?seccion=noticia-25022026)).
- **No hay API**: la presentación es por el **portal de la SCVS** con usuario y clave de la
  compañía → automatizable solo en preparación y recordatorios, no en el envío.
- **Ya implementado** (esta iteración): las 3 obligaciones SCVS entran al motor de cumplimiento
  anual, a la ficha de la sociedad y al bot, con fechas y registro por CEP.
- **Riesgo de no cumplir**: multas automáticas (sin ventana de gracia) y bloqueo de trámites
  societarios.

---

## 2 · Quién está obligado

| Tipo | ¿Presenta SCVS? | Nota |
|---|---|---|
| **S.A.** | Sí | Paquete anual + auditoría según activos |
| **Cía. Ltda.** | Sí | Auditoría según umbral |
| **S.A.S.** | **Sí** | Mismo régimen de reporte; es nuestro segmento |
| Sucursal de compañía extranjera | Sí | Auditoría si activos > 273 SBU |
| Holdings / grupos | Sí | Estados consolidados + auditoría obligatoria |
| Persona natural sin compañía | No | Solo SRI |

---

## 3 · Obligaciones y plazos

| # | Obligación | Vence | Formato / evidencia | Fuente |
|---|---|---|---|---|
| 1 | **Nómina de socios / accionistas** (incluye cadena hasta persona natural; si hay socio extranjero: certificado de existencia, poder apostillado) | **último día de febrero** | PDF notariado / apostillado | SCVS 2026 |
| 2 | **Estados financieros** del ejercicio (firmados por representante legal y contador; NIIF o NIIF PYMES) | **30 de abril** | PDF/XLS del portal | Commenda 2026 |
| 3 | **Actas de junta** que aprueban los estados financieros (junta ordinaria **antes del 31 de marzo**) | **30 de abril** | PDF | Commenda 2026 |
| 4 | **Informe de auditor externo** (si activos > ~1.366 SBU ≈ USD 642.020; sucursales > 273 SBU; holdings siempre) | **30 de abril** | PDF | Res. SCVS-INC-DNCDN-2025-0005 |
| 5 | **Copia del Formulario 101** presentado al SRI | **30 de abril** | PDF | Commenda 2026 |
| 6 | **Actualización de beneficiario final** | según SRI (REBEFICS, febrero) | XML/APS | SRI |

> Nota: la SCVS **no cobra** por presentar, pero **multa automáticamente** por atraso.

---

## 4 · Cómo se implementó en el sistema (esta iteración)

### 4.1 · Motor de cumplimiento

`services/complianceEngine.ts` → en el bloque anual de sociedades se agregan:

```ts
obligations.push({ type: 'SCVS_SOCIOS', label: 'SCVS · Nómina de socios' });
obligations.push({ type: 'SCVS_EEFF',  label: 'SCVS · Estados financieros' });
obligations.push({ type: 'SCVS_ACTAS', label: 'SCVS · Actas de junta' });
```

Con eso **aparecen solas** en:
- la **matriz** del período anual,
- el **bot** (`get_company_obligations`),
- los recordatorios de empresas,
- el panel de cumplimiento por cliente.

### 4.2 · Ficha de la sociedad

`CompanyAnnexActions.tsx` → “Presentaciones anuales {año}” ahora lista:

| Ítem | Vence |
|---|---|
| REBEFICS (APS) | febrero |
| 1021 Renta Sociedades | abril |
| ADI Dividendos | mayo |
| **SCVS · Nómina de socios** | **último día de febrero** |
| **SCVS · Estados financieros** | **30 de abril** |
| **SCVS · Actas de junta** | **30 de abril** |

- Se registran con el mismo botón **Registrar** (CEP opcional) → quedan como `declarations`
  con tipo `SCVS_*` y período `{año}`.
- Botón nuevo **“Abrir Superintendencia de Compañías”** al portal de trámites
  (`iib.supercias.gob.ec`).

### 4.3 · Dónde NO se automatiza (a propósito)

- **El envío**. La SCVS no publica API y exige sesión con clave de la compañía, firma del
  representante y documentos notariados. La extensión **no** debe credencializar ese portal:
  riesgo de bloqueo y de datos personales.
- **La firma del contador** en estados financieros.

---

## 5 · Roadmap para dejarlo completo

| Fase | Qué | Esfuerzo | Valor |
|---|---|---|---|
| **1 (hecho)** | Obligaciones + fechas + registro + botón al portal | S | Visibilidad y cero olvidos |
| **2** | **Checklist de documentos** por compañía: subir PDFs a R2 y marcar cada requisito | M | Evidencia ordenada para el contador |
| **3** | **Generar estados financieros** desde los datos que ya tenemos (1021/ATS/compras-ventas) → borrador NIIF PYMES para revisión | L | Ahorro de horas real |
| **4** | **Recordatorios escalonados** al representante legal (febrero y abril) con estado de cada documento | S | Cumplimiento puntual |
| **5** | **Auditoría automática del umbral**: con activos del balance, decidir si requiere auditor | S | Evita sorpresas |
| **6** | **Expediente societario** en la ficha: constitución, nombramientos, actas, nómina histórica | M | Producto “todo en uno” |

### Modelo de datos propuesto (fase 2)

```ts
taxProfile.scvs = {
  ejercicio: 2026,
  socios: [{ tipo: 'natural'|'juridica', nombre, ruc, porcentaje, pais, documento }],
  documentos: {
    nomina:      { r2Key, subido, cuando, aprobado },
    eeff:        { r2Key, subido, cuando, firmadoPor },
    actas:       { r2Key, subido, cuando, fechaJunta },
    auditoria:   { requerida, r2Key?, subido },
    form101:     { r2Key, presentado, cep },
  },
  estado: 'pendiente' | 'en_revision' | 'presentado',
};
```

---

## 6 · Riesgos y multas

- **Multa automática** de la SCVS por no presentar el paquete anual; no hay aviso previo.
- **Bloqueo de trámites**: aumentos de capital, nombramientos, cambios de objeto.
- **Beneficiario final no informado**: el SRI aplica **28 % de Renta** en lugar de 25 % durante
  todo el ejercicio (ver `REBEFICS_APS.md`).
- Sociedad sin **nómina de socios** actualizada no puede inscribir reformas de estatutos.

---

## 7 · Qué debe hacer VIMARBO (S.A.S.) este año

1. **Febrero**: nómina de socios actualizada (BORIS 51 % / KARLA 49 %) + certificados.
2. **Antes del 31 de marzo**: junta ordinaria que aprueba los estados financieros 2025.
3. **Antes del 30 de abril**: presentar en el portal SCVS: EEFF firmados, actas, nómina,
   copia del 101.
4. Verificar umbral de auditoría (activos ~USD 642.020) — VIMARBO, por tamaño, **no** requiere.

---

## 8 · Fuentes

- [SCVS · Compañías con socios extranjeros deben presentar su información hasta febrero](https://www.supercias.gob.ec/portalscvs/Noticias/Noticias.php?seccion=noticia-25022026)
- [Commenda · Annual Compliance Filing Guide in Ecuador (30-abr, umbrales de auditoría, beneficiario final)](https://www.commenda.io/ecuador/annual-compliance)
- [SCVS · Portal de trámites](https://iib.supercias.gob.ec/portaltramites/portal.html)
- [SCVS · Portal de información](https://appscvsmovil.supercias.gob.ec/PortalInformacion/index.html)
- Normativa citada: Resolución **SCVS-INC-DNCDN-2025-0005** (umbrales de auditoría) y
  Reglamento de remisión de información de compañías con socios extranjeros.
