# Correr el bucle en Android + que se vea como app nativa

**Fecha:** 16-nov-2026 · Responde a: *¿qué navegador de Android acepta la extensión?*
*y ¿se puede ver como una APK nativa?*

---

## 1 · La verdad corta

- **Chrome para Android NO acepta extensiones.** No hay flag ni menú oculto: la
  versión de Play Store no las soporta, y el Web Store muestra “no disponible en
  este dispositivo”.
- **Kiwi Browser** (el favorito durante años) **cerró en 2025**. Cualquier guía que
  lo recomiende está desactualizada.
- **Sí funcionan hoy** (según [ExtensionBooster, jul-2026](https://dev.to/extensionbooster/chrome-extensions-on-android-in-2026-what-actually-works-extensionbooster-pl)):

| Navegador Android | Extensions | MV3 | Nota |
|---|---|---|---|
| **Quetta Browser** | ✅ Chrome Web Store | ✅ | Fork Chromium activo; el reemplazo más directo de Kiwi |
| **Helium Browser** | ✅ Chrome Web Store | ✅ | Fork Chromium open-source |
| **Yandex Browser** | ✅ | ✅ | Funciona bien; tema privacidad/país |
| **Edge Canary (Android)** | ⚠️ experimental | ⚠️ | Puede romperse entre builds |
| **Firefox Android** | ✅ addons.mozilla.org | ✅ (WebExtensions) | Oficial, pero **hay que portar** la extensión (APIs `browser.*`, sin `chrome.*` directo) |
| Chrome Android / Samsung Internet | ❌ | — | No hay soporte |

> Google está preparando un **Chrome de escritorio para Android** (PCs Android /
> plegables en modo escritorio) que sí instalará extensiones, pero **no es para
> teléfonos comunes**.

---

## 2 · Qué significa para nuestra extensión (Nueva Luz 3.0, MV3)

La 01 es **Manifest V3** con: content scripts, `chrome.storage`, service worker
`background` y `chrome.tabs`. Eso es justo lo que Quetta/Helium/Yandex soportan.

Checklist antes de probar en Android:

1. **Cargar el ZIP/CRX** desde el navegador fork → “Extensiones → cargar
   descomprimida” (en Android se suele permitir desde archivo o desde el Web Store).
2. **Probar el popup a 360 px**: ya está pulido (compacto, tema claro, drawer).
3. **Probar el bridge con la web**: la web publica `SRI_ESTADO_MES` y la extensión
   lo guarda → en Android funciona igual, porque es `postMessage` + `chrome.storage`.
4. **Sesión del SRI**: el portal es responsive y el login lo maneja la extensión.
5. **Limitaciones reales en Android**:
   - **Descarga de PDFs** a veces abre visor propio en vez de descargar → usar
     “Compartir” o el botón de descarga del visor.
   - **Pestañas en segundo plano** se matan más agresivamente: el bucle debe correr
     **con la pestaña del SRI en primer plano** y el teléfono desbloqueado.
   - **Bloqueo de pantalla** pausa la automatización: recomendar “mantener activo”.

**Recomendación práctica:** **Quetta** o **Helium** para el bucle en el celular;
**Yandex** como segunda opción; **Edge Canary** sólo para pruebas.

---

## 3 · Que se vea como APK nativa (sin Play Store)

Ya implementado en la web (**PWA instalable**):

- `public/manifest.webmanifest` — nombre, iconos 192/512 (maskable), `display: standalone`,
  atajos a Declaraciones / Clientes / Bucle.
- `public/sw.js` — arranque al instante y shell offline (navegación: red primero).
- Botones **“Instalar app”** en el pie del sidebar y del menú móvil; en iPhone
  explica *Compartir → Añadir a pantalla de inicio*.
- Meta `theme-color`, `apple-mobile-web-app-capable`, iconos `apple-touch`.

**Resultado en Android:** icono en la pantalla de inicio, splash, pantalla completa
sin barra del navegador, atajos por long-press. Se siente como una app.

### Si querés APK real (Play Store o sideload)

1. **Bubblewrap** (`@bubblewrap/cli`) envuelve la PWA en una **TWA** (Trusted Web
   Activity) → un `.apk`/`.aab` firmado que abre la web sin barra.
2. Requisitos: HTTPS, `manifest` válido (✅), `assetlinks.json` en
   `/.well-known/` con el SHA-256 de la firma.
3. Alternativa sin fricción: **PWABuilder** (web) genera el paquete y los recursos.

> La TWA sigue necesitando la web online; no incluye la extensión. Para el bucle
> en el teléfono, el navegador con extensiones (Quetta/Helium) sigue siendo la vía.

---

## 4 · La otra forma: “bucle remoto” (sin extensión en el celular)

La más robusta a futuro y la que hace que el celular sea sólo el panel:

1. Un **runner** (PC del estudio, mini-PC o VPS Windows) corre Chrome con la
   extensión + un endpoint (WebSocket/SSE).
2. El celular (PWA) manda “correr el mes” y recibe progreso/ETA; no necesita
   extensiones ni sesión del SRI.
3. Ventajas: no depende del navegador del teléfono, el bucle no se corta al
   bloquear la pantalla, y el 100 % del trabajo queda en un equipo confiable.
4. Costo: mantener el runner encendido y un canal seguro.

**Ruta sugerida:** empezar con **Quetta/Helium + PWA** (hoy), y evaluar el
**bucle remoto** cuando haya más de 2 usuarios corriendo el mes desde el teléfono.

---

## 5 · Prueba mínima en Android (30 minutos)

1. Instalar **Quetta** (o Helium) desde Play Store.
2. Cargar el ZIP `SC-PRO-01-NuevaLuz-v3.5.1.zip` como extensión.
3. Abrir la web → **Instalar app** (queda el icono).
4. Login con un cliente chico → **Sólo entrar** (👁️) → verificar que queda en el perfil.
5. Correr un **lote de 1 cliente** con la pestaña del SRI en primer plano.
6. Revisar que el acuse aparezca en el popup y en la web.

---

## 6 · Fuentes

- [ExtensionBooster · Chrome Extensions on Android in 2026](https://dev.to/extensionbooster/chrome-extensions-on-android-in-2026-what-actually-works-extensionbooster-pl)
- [Microsoft Q&A · Android Extensions for Edge](https://learn.microsoft.com/en-us/answers/questions/2377325/android-extensions-for-edge)
- [AMD · Edge para Android y las extensiones de escritorio (2025)](https://www.profesionalreview.com/2025/10/23/edge-para-android-por-fin-te-dejara-todas-usar-las-extensiones-de-escritorio-asi-puedes-activar-la-funcion-oculta/amp/)
- [MDN · Differences between desktop and Android extensions](https://extensionworkshop.com/documentation/develop/differences-between-desktop-and-android-extensions/)
- [Bubblewrap (TWA)](https://github.com/GoogleChromeLabs/bubblewrap)
