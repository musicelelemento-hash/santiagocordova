---
name: equipo-lider
description: Cómo trabajar como LÍDER de un equipo de agentes (explorador, implementador, verificador) — cuándo conviene delegar y cuándo no, cómo escribir el encargo, cómo repartir en paralelo sin que se pisen y cómo revisar lo que entregan antes de publicar. Úsala cuando la tarea toque muchos archivos o pantallas, cuando haya que barrer el código para entender algo, o cuando el usuario pida «usa los agentes», «equipo», «líder», «obreros».
---

# Trabajar como líder del equipo

Basado en la guía de Anthropic («Building effective agents» y «How we built our
multi-agent research system») y en lo que funcionó en el proyecto santiagocordova.com.

## El equipo

| Agente | Modelo | Para qué |
|---|---|---|
| **líder** (tú, la sesión principal) | el más capaz | entender, decidir, repartir, revisar, verificar y publicar |
| `explorador` | Haiku | barrer el código y devolver un mapa `archivo:línea` |
| `implementador` | Sonnet | hacer cambios ya decididos en archivos asignados |
| `verificador` | Haiku | correr los chequeos y dar un veredicto corto |

La lógica delicada (dinero, impuestos, credenciales, datos de clientes, lo que el
`CLAUDE.md` del proyecto marque como sensible) la haces **tú**, no un agente.

## ¿Delegar o no?

- **Sí:** trabajo repetido en muchas pantallas/archivos independientes; barridos
  para entender cómo fluye algo; correr pruebas y resumir la salida.
- **No:** un arreglo puntual (lo haces más rápido y más barato), o varias manos
  sobre el **mismo archivo** (se pisan: Anthropic advierte que programar se reparte
  peor que investigar).
- **Costo:** un equipo gasta ~15× lo de una conversación normal. Escala el tamaño
  a la tarea: 1 agente para algo simple, 2–4 para comparar, más sólo si cada uno
  tiene una parte claramente separada.

## El encargo (lo que más mejora el resultado)

Cada encargo lleva estas cuatro cosas; si falta alguna, el agente improvisa o duplica:

1. **Objetivo**: qué tiene que quedar distinto y para qué.
2. **Archivos y límites**: los únicos que puede tocar y lo que NO debe tocar.
3. **Piezas / fuentes**: qué componentes, clases o funciones existentes usar (con su ruta).
4. **Formato de entrega**: qué reportar (cambios con línea, resultado de chequeos, dudas).

Plantilla:

```
Objetivo: …
Archivos que puedes editar (sólo estos): …   · No toques: …
Usa: …(ruta de cada pieza)
Verifica con: …
Reporta: archivos y cambios con línea · resultado de los chequeos · lo que no hiciste y por qué
```

## En paralelo

Lanza varios a la vez sólo si cada uno tiene **archivos propios**. Si dos necesitan el
mismo archivo compartido (un CSS global, un archivo de rutas), o lo hace uno solo o
lo haces tú después.

## Revisar antes de publicar (siempre)

1. `git diff` filtrando lo que es presentación, para ver si quedó algún cambio de lógica.
2. Lo que el agente dijo que le preocupaba: compruébalo tú.
3. Variables nuevas en `.map(…, idx)`: que no sombreen otra.
4. Corre (o pide al `verificador`) los chequeos del proyecto.
5. Si se puede, míralo funcionando (captura de pantalla, prueba con datos reales).
6. Recién entonces commit y publicación.
