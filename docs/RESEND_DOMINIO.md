# Verificar el dominio en Resend (paso a paso)

Objetivo: poder enviar correos desde **`facturacion@santiagocordova.com`** en vez
del remitente de prueba.

Estado actual: dominio **creado** en Resend (id `6cfb0887-…`), pendiente de DNS.

---

## 1 · Registros exactos que pide Resend

Cargalos en el proveedor de DNS de `santiagocordova.com` (Cloudflare, GoDaddy,
Namecheap…). Los nombres son **relativos**: `resend._domainkey` significa
`resend._domainkey.santiagocordova.com`.

| Tipo | Nombre | Valor | Prioridad | TTL |
| :--- | :--- | :--- | :--- | :--- |
| **TXT** | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDphqbF7Mc6e0tnUlKBzbZz31Pln8hq+Ssy/t4pk/3yfR90usobkAgD1fAJJZkP5tVl4f+Tbn2Jdnxbj8SD/Zv6tv3dMcWNMcVukK8WApNtO4MqGgdmv186GEzXFubmU2220h7oSoPV1MSZRMEZlVZJhCr4eSu3G9uXyB98w9HSJwIDAQAB` | — | Auto |
| **MX** | `send` | `feedback-smtp.us-east-1.amazonses.com` | **10** | Auto |
| **TXT** | `send` | `v=spf1 include:amazonses.com ~all` | — | Auto |
| **CNAME** | `rsend` | `send.forge.rmta.net` | — | Auto |

> El DKIM es **una sola línea larga**: pegalo completa, sin cortes ni espacios.

---

## 2 · Cómo cargarlos según el proveedor

### Cloudflare (el más común)

1. Dashboard → tu dominio → **DNS** → **Records** → **Add record**.
2. Cargá los cuatro, uno por uno, con **Proxy status: DNS only** (nube gris).
3. El `CNAME rsend` debe quedar **sin proxy** (si no, Resend no lo valida).

### GoDaddy / Namecheap / Donweb

- Panel **DNS Management** → *Add new record*.
- TTL: `Auto` o `3600`.
- Para el MX, la prioridad es **10**.

---

## 3 · Disparar la verificación

Desde Resend: **Domains → santiagocordova.com → Verify DNS records**.

O por API (sin exponer la clave acá):

```powershell
$key = "<RESEND_API_KEY>"
$id  = "6cfb0887-6b48-4a1d-a05e-f9d7256ceda4"
Invoke-RestMethod -Method Post -Uri "https://api.resend.com/domains/$id/verify" `
  -Headers @{ Authorization = "Bearer $key" }
```

Suele tardar entre **2 minutos y 2 horas** (propagación DNS). Estados:

| Estado | Significado |
| :--- | :--- |
| `not_started` | todavía no se pidió verificar |
| `pending` | DNS cargado, esperando propagación |
| `verified` | ✅ ya se puede enviar desde el dominio |
| `failed` | algún registro está mal (revisar cuál) |

Consultar el estado:

```powershell
Invoke-RestMethod -Uri "https://api.resend.com/domains/$id" `
  -Headers @{ Authorization = "Bearer $key" } | Select-Object status, name
```

---

## 4 · Después de `verified`

En el bot (Render), dejar:

```
RESEND_API_KEY=<la clave rotada>
RESEND_FROM=Soluciones Contables Pro <facturacion@santiagocordova.com>
RESEND_REPLY_TO=santiagocordova@gmail.com
```

Y **quitar** `RESEND_FROM_FALLBACK` (o dejarlo vacío).

Mientras no esté verificado, el despachador usa el respaldo:

```
RESEND_FROM_FALLBACK=Soluciones Contables Pro <onboarding@resend.dev>
```

Ese remitente **solo entrega al correo de la cuenta de Resend** — sirve para
probar el envío de punta a punta (llegada, formato, adjunto), no para clientes.

---

## 5 · Prueba de extremo a extremo

1. En Notificaciones, componé un mensaje **a tu propio correo**.
2. `POST /notificaciones/despachar` en el bot (o esperá 1 minuto).
3. En la bandeja debería pasar a **enviado**; si no, mirá `error`.

Cuando llegue bien: verificar el dominio → cambiar `RESEND_FROM` → probar con un
cliente real.
