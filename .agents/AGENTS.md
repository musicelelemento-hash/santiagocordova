# Soluciones Contables Pro / santiagocordova.com — mapa corto

> Este archivo se carga en CADA conversación: se mantiene corto a propósito.
> El detalle, la historia de cada decisión y los números de la base están en
> **`.agents/HISTORIAL.md`** — leé sólo la sección del tema que vas a tocar.
> El tablero del ecosistema completo (extensión Nueva Luz) está en el
> `.agents/AGENTS.md` de la raíz del workspace, §0b.

## Qué es
Plataforma del estudio contable de Santiago Córdova (SC Estrategias Fiscales,
Pasaje, El Oro, Ecuador): página pública + panel interno (clientes, matriz SRI,
cobranza, facturación) + Baku (bot de Telegram en Render) + extensión Nueva Luz
(otro repositorio). Meta de negocio: 3.000 clientes de IVA mensual.

## Dónde está cada cosa
| Tema | Archivos |
|---|---|
| Tipos y estado | `types/client.ts`, `store/useAppStore.ts` |
| Reglas SRI (vencimientos, períodos, RUC) | `services/sri.ts`, `services/complianceEngine.ts` (skill `sri-ecuador`) |
| Inicio «Hoy» y menú | `screens/HoyScreen.tsx`, `App.tsx` (`MENU_ESENCIAL`), `components/layout/Sidebar.tsx` (`NAV_GROUPS`) |
| Marketing «Crecer» | `screens/CrecerScreen.tsx`, `services/marketing.ts`, `components/marketing/*` |
| Pendientes (web ↔ Baku) | `services/pendientes.ts` y `telegram-bot/src/pendientes.ts` (misma regla, dos copias con pruebas) |
| Baku | `telegram-bot/src/`: `index.ts` (menú, callbacks), `cron.ts`, `parte_diario.ts`, `reporte_diario.ts`, `resumen_semanal.ts`, `clientes_botones.ts`, `cierre.ts`, `comandos.ts` |
| Sala de envío WhatsApp | `components/features/SalaDeEnvio.tsx` |
| Pruebas | web `npm test` (carpeta `tests/`) · bot `cd telegram-bot && npm test` |

## Reglas que no se rompen
1. **Nada se envía solo a clientes** (WhatsApp, correo): siempre de a uno o con un toque de Santiago. Baku sólo le escribe a Santiago.
2. **Cobrar no es declarar**: usar `estadoAlCobrar()`; `is_paid` + `paid_at`; el estado sube a `Pagada` sólo si ya estaba declarada.
3. **Probar claves del SRI: de a una y pedido a mano** (el SRI bloquea cuentas).
4. **No** `whatsapp-web.js`/Baileys (banean el número del estudio). WhatsApp masivo sólo vía Cloud API de Meta.
5. **Datos del SRI sólo verificados** (skill `sri-ecuador`). Costos de Meta = supuestos editables, nunca precios.
6. **Comandos de Baku en dos listas** (`telegram-bot/src/comandos.ts` y `BAKU_COMMANDS` en `screens/TelegramBotScreen.tsx`): cambiar ambas; `npm test` del bot lo verifica.
7. **La base**: no existen columnas `client_type` ni `requires_declarations` (van en `tax_profile`); el comprobante puede estar en `sri_declaraciones.proof_file` **o** en `clients.declaration_history` (mirar las dos); `select *` de clientes pesa ~16 MB (pedir columnas justas).
8. Paleta: Obsidian `#020617`/`#0F172A`, Azure `#2B6AFF`, Violet `#6366F1`, Emerald `#04B17B`. Manrope para texto, JetBrains Mono para RUC y números.
9. Datos de clientes (actas, RUC, nombres) no se suben al repositorio.

## Pendientes principales (detalle en HISTORIAL.md §7)
- 🔴 **Seguridad**: la llave pública puede leer la tabla `clients` (claves SRI, firmas). Cerrarlo pide cambiar la extensión Nueva Luz (otro repo) para que inicie sesión.
- Feriados 2027 en `FERIADOS_EC` (Render).
- Correo `contacto@santiagocordova.com` (ver registros MX en Namecheap antes).
- VIMARBO S.A.S.: paquete SCVS 2025 vencido (borradores generados; faltan estados financieros de la contabilidad).
- Generador de anexos ATS/RDEP (fase 2).
