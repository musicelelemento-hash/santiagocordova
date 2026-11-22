# Pasos para cuando llegues a casa

> Escrito el 22-nov-2026. Son las cosas que solo puedes hacer tú desde la
> laptop, para que todo quede en su lugar y Claude tenga acceso a todo.
> Hazlas en este orden: la 1 es la que destraba el arreglo de seguridad.

## Dónde va cada cosa

| Qué | Dónde | Por qué ahí |
|---|---|---|
| Esta web | GitHub, `santiagocordova` (ya está) | — |
| La extensión Nueva Luz | GitHub, **repositorio nuevo y privado** | Para arreglar la seguridad hay que cambiar su código |
| Respaldos, evidencias, documentos de clientes, firmas .p12 | **Google Drive**, carpeta «SC Respaldo» | En GitHub quedarían guardados para siempre, aunque los borres |
| `.env.local` y contraseñas | **Solo en la laptop** (o un gestor de contraseñas) | No se suben a ningún lado |

## 1. Subir la extensión a GitHub (15 min)

1. Instala **GitHub Desktop** (desktop.github.com) e inicia sesión con tu cuenta de GitHub.
2. Abre la carpeta de la extensión y **saca** cualquier archivo `.env`, `.p12`, `.pfx` o
   de contraseñas que haya dentro. Muévelos a otra carpeta, por ejemplo a la del respaldo.
3. En GitHub Desktop: **File → Add local repository** → elige la carpeta de la extensión.
   Si dice que no es un repositorio, pulsa **create a repository**.
4. Pulsa **Publish repository**. Deja marcado **Keep this code private**.
   Nombre sugerido: `nueva-luz-extension`.
5. Escríbele a Claude: «la extensión está en GitHub como `nueva-luz-extension`».

## 2. Subir respaldos y evidencias a Drive (lo que tarde la subida)

1. En drive.google.com crea la carpeta **SC Respaldo** con estas subcarpetas:
   - `Evidencias`: capturas, comprobantes y pruebas de trabajos.
   - `Respaldos de datos`: copias de la base, Excel y exportaciones.
   - `Documentos de clientes`: contratos, autorizaciones y firmas .p12.
   - `Varios`: lo que no sepas dónde va.
2. Arrastra los archivos desde la laptop. Si es mucho, instala **Google Drive para escritorio**
   y copia la carpeta entera; se sube sola.
3. No compartas esa carpeta con nadie: Claude la lee con tu propia cuenta.
4. Escríbele a Claude: «el respaldo está en Drive, carpeta SC Respaldo».

## 3. Crear la tabla de errores de la web (2 min)

El código ya está publicado y espera la tabla. Haz una de las dos:

- **Fácil:** dile a Claude «crea la tabla de errores» y aprueba la ventanita que aparece.
  En el celular venció dos veces sin que te llegara; desde la laptop sí aparece.
- **A mano:** en supabase.com → tu proyecto → **SQL Editor**, pega el contenido de
  `database/web_errors.sql` y pulsa **Run**.

## 4. Cambiar la contraseña del panel (2 min)

La compartiste en el chat. En supabase.com → **Authentication → Users** → tu usuario →
**Send password recovery**, o desde la pantalla de inicio de sesión del panel si tiene
«Olvidé mi contraseña».

## 5. Correo contacto@santiagocordova.com (5 min, solo mirar)

En namecheap.com → **Domain List** → santiagocordova.com → **Manage** → **Advanced DNS**.
Saca una captura de los registros **MX** y de la sección **Mail Settings** y mándasela a
Claude. Con eso se ve qué servicio de correo usas y se crea el reenvío sin romper los
correos que ya tienes.

## 6. (Opcional) Que Claude vea la carpeta de la laptop directamente

Claude de escritorio → **Ajustes → Claude Code → Remote Control** → agrega la carpeta.
Solo funciona con la laptop prendida y todavía no está disponible para todas las cuentas.
Con los pasos 1 y 2 no hace falta.

## Lo que hace Claude después

1. Con la extensión en GitHub: hacer que la extensión inicie sesión y **cerrar el acceso
   público a la tabla de clientes** (el arreglo urgente de seguridad).
2. Con el respaldo en Drive: ordenarlo y anotar en el proyecto dónde está cada cosa.
3. Cargar los feriados 2027 en Baku cuando el Gobierno publique el calendario oficial.
