# Soluciones Contables Pro - Mapa Neuronal, Visión de Vara Alta y Reglas de Desarrollo

Este documento define la **Misión, Mapa de Arquitectura (Neuronas del Sistema), Estado de Módulos y Reglas Operativas** para la plataforma **Soluciones Contables Pro / SantiagoCordova.com**. Sirve como punto de entrada de contexto ultrarrápido para Agentes de IA y desarrolladores, optimizando el consumo de tokens y la velocidad de ejecución.

---

## 🚀 1. Misión y Visión de Vara Alta

* **Misión**: Consolidar la plataforma SaaS definitiva de gestión contable, fiscal, cobranza y automatización tributaria en Ecuador, adaptada 100% a la normativa del SRI (RIMPE, Régimen General, IVA, Impuesto a la Renta, Anexos, Facturación Electrónica y Firmas .p12).
* **Vara Alta (Estándar de Élite)**:
  * **Aesthetic Superiority**: Estética militar/espacial de centro de comando ("Obsidian Navy, Azure Vivid, Kinetic Emerald") con Glassmorphism 2.0 y micro-interacciones de precisión.
  * **Cero Carga Falsa**: Ninguna tarea repetitiva manual para el contador (autocompletado SRI, lectura de PDFs con IA Gemini, inyección vía extensión web).
  * **Claridad Segmentada**: Distinción quirúrgica entre clientes de contabilidad completa (Matriz SRI activa) y clientes de solo compra de software/firmas (Solo Plan).

---

## 🧠 2. Mapa Neuronal del Sistema (Contexto Ultrarrápido)

### A. Núcleo de Estado y Tipos (Core)
* [types/client.ts](file:///c:/Programacion/Paginas%20Web/SantiagoCordova.com/santiagocordova-main/types/client.ts): Definición completa de `Client`, `Declaration`, `TaxProfile`, `FacturadorConfig`, `TaxRegime`, `clientType` (`completo` | `solo_plan`).
* [store/useAppStore.ts](file:///c:/Programacion/Paginas%20Web/SantiagoCordova.com/santiagocordova-main/store/useAppStore.ts): Estado global en Zustand para clientes, configuraciones de tarifas, configuraciones del sistema, firma activa y bóveda.
* [services/complianceEngine.ts](file:///c:/Programacion/Paginas%20Web/SantiagoCordova.com/santiagocordova-main/services/complianceEngine.ts): Motor de cálculo de cumplimiento tributario, vencimientos por 9no dígito RUC, resumen de deudas y atrasos (con desvío automático para clientes `solo_plan`).
* [services/sri.ts](file:///c:/Programacion/Paginas%20Web/SantiagoCordova.com/santiagocordova-main/services/sri.ts): Validaciones de RUC/Cédula, fechas de vencimiento SRI, claves SRI y cálculo de períodos IVA/Renta.

### B. Módulos Principales (Screens & Components)
* 🛡️ **Matriz SRI (`TaxComplianceMatrix.tsx`)**: Cuadrícula de seguimiento mensual/semestral de IVA, Renta y Anexos.
* ⚡ **Venta de Planes (`SalesComboModal.tsx`)**: Asignador de firmas .p12, combos EcuaFact/ZiFact, cobros y selector de modalidad (Solo Plan vs Completo).
* 👥 **Directorio de Clientes (`ClientsScreen.tsx`, `ClientCard.tsx`, `ClientForm.tsx`, `ClientDetailView.tsx`)**: Ficha 360°, credenciales, alertas de firma y portal del cliente.
* 🧾 **Facturación SRI (`FacturacionSriScreen.tsx`, `SriPosTerminalModal.tsx`)**: Emisión de facturas electrónicas, retenciones, notas de crédito y RIDE PDF.
* 💰 **Cobranzas & Caja (`CobranzaScreen.tsx`, `CajaChicaScreen.tsx`)**: Control de honorarios pendientes, recibos y caja chica.
* 🧩 **Extensiones SRI (`SriExtensionsStore.tsx`, `extenciones web/`)**: Catálogo de extensiones y scripts de inyección automática en el SRI.
* 🔄 **Conversor SRI (`AdaptadorConvert.tsx`)**: Importación/exportación masiva Excel/CSV/XML.

---

## 📊 3. Estado de Módulos & Hoja de Ruta (Roadmap)

| Módulo / Proyecto | Estado | Estado Actual / Próximo Paso |
| :--- | :--- | :--- |
| **Aislamiento Solo Plan / Matriz SRI** | 🟢 **100% Completado** | Clientes de solo plan exentos de la matriz y alertas. |
| **Venta de Planes & Combos** | 🟢 **100% Completado** | Registro de .p12, credenciales y emisión comprobante SRI. |
| **Matriz de Cumplimiento SRI** | 🟡 **95% (Casi Listo)** | Funcional. Pendiente: Exportador masivo de reportes en Excel/PDF para auditoría. |
| **Extensiones Web SRI (Chrome/Edge)** | 🟡 **80% (En Proceso)** | Inyección funcional. Pendiente: Empaquetador `manifest.json` v3 listo para distribución e importador 1-click de facturas recibidas del SRI. |
| **Automatización WhatsApp** | 🟡 **85%** | Mensajería por etapas lista. Pendiente: Envío programado masivo con 1-clic. |
| **Generador de Anexos (ATS / RDEP)** | 🔴 **Pendiente (Fase 2)** | Generación automática de XMLs de Anexos a partir de comprobantes guardados. |

---

## 🎨 4. Directrices de Estilo Visual y Estética Premium (Obsidian & Azure)

### A. Paleta de Colores
* **Primario (Azure Vivid):** `#2B6AFF`
* **Secundario (Electric Violet):** `#6366F1`
* **Terciario (Kinetic Emerald):** `#04B17B`
* **Fondo Dark (Obsidian Navy):** `#020617` a `#0F172A` (`.gradient-obsidian`)

### B. UI / UX & Eficiencia de Tokens
1. **Componentes Glassmorphism**: Usar `.glass-card-premium` y transiciones suaves.
2. **Tipografía Contable**: Nombres en `Manrope`, RUC/Cédulas en `JetBrains Mono` (`font-mono`).
3. **No Token Wasting**: No realizar lecturas de archivos innecesarias; consultar este mapa para ubicar archivos clave al instante.
