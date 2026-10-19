---
name: selector
description: Elegir skill y modelo para la tarea que empieza. Usar al empezar cada tarea del roadmap, al recibir un bug o una petición de diseño, y cuando la usuaria pregunte qué flujo o modelo conviene.
---

# Selector de skill y modelo

Al empezar una tarea, clasifícala con la tabla y actúa según su fila. Flujo completo de una tarea, guía y motivos:
[`docs/runbooks/skills-y-modelos.md`](../../../docs/runbooks/skills-y-modelos.md).

| Caso | Skill | Modelo de la sesión | Subagentes |
|---|---|---|---|
| Diseño nuevo o decisión abierta (mecánica, arquitectura, UX, algo que pide a la usuaria o a Álvaro) | `grilling` + `domain-modeling` (o `/grill-with-docs` si lo lanza la usuaria); `prototype` si hay números o reglas que la usuaria tiene que probar | grande (Opus) | búsquedas con `Explore` en ligero (Haiku) |
| Bug hallado jugando, test rojo o intermitente | `diagnosing-bugs` | grande si no es obvio; medio (Sonnet) si la causa se ve a la primera | — |
| Cambio de varios sistemas, BD, migración, concurrencia (`CR-*`, `REI-*` de motor) | — (plan del hito) | grande | ligero para buscar usos |
| Tarea de roadmap acotada (componente, ajuste, test, endpoint pequeño) | — | medio | — |
| Cambio mecánico (docs, bitácora, renombrar, adaptar tests a una firma nueva) | — | medio o ligero | ligero |
| Revisar el diff antes de un PR a `main` | `/code-review` (de serie) y, tras los arreglos, `pr` para la descripción | grande | — |
| Cierre de fase o de hito | `retro` (la lanza Claude; las propuestas las confirma la usuaria); cada pocas fases, `/improve-codebase-architecture` | grande | — |
| Escribir CLAUDE.md, skills o documentos para agentes | `writing-for-agents` | medio | — |

Reglas:

- El modelo de la sesión lo elige la usuaria (`/model`); no se puede cambiar desde dentro. Si la fila
  pide otro distinto del actual, dilo en **una línea** al empezar («esto pide modelo grande») y
  sigue; no esperes respuesta salvo que el riesgo sea alto (migración de datos, borrado).
- A un subagente se le pone el modelo de la columna «Subagentes» con el parámetro `model`. Solo se
  delegan búsquedas o tareas mecánicas; el diseño y las decisiones se quedan en la sesión principal.
- Con el plan cerrado y escrito, la implementación acotada va a un subagente `sonnet` y la sesión principal
  revisa su diff (`QA-117`).
- **Presupuesto de compactaciones** (`QA-116`): al empezar, estima cuántas pide la tarea, de 1 a 5 (un arreglo
  o un texto, 1; una ronda de un bloque, 2-3; varios sistemas, 4-5), y apúntalo en la fila de la bitácora con
  las que lleva la sesión (`recuperar.py --estado`): «presupuesto 3, desde la 15». Al acabar cada sub-bloque,
  con commit y push, dile a la usuaria «buen momento para `/compact <qué conservar>`». Si se agota el presupuesto
  con la tarea a medias, cierra en un punto estable, bitácora al día, y pide sesión nueva: la tarea era más
  grande y se parte.
- En la duda entre dos filas, la de más riesgo.
- Lo decidido en un `/grill-with-docs` va a su roadmap o a la bitácora (decisiones), igual que
  siempre; el glosario a `GLOSSARY.md` y las decisiones difíciles de revertir a `docs/adr/`.
