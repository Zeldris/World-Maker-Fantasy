# Ampliar lore — runbook

**Qué es:** los pasos a seguir cuando la usuaria escriba **"ampliamos lore"** (o pida una sesión de
añadir/mejorar lore en general, no un bug ni una feature de código). Objetivo: la próxima vez,
arrancar directamente en este modo de trabajo en vez de tener que redescubrirlo. Ver también
`docs/ampliar-lore-checklist.md` — el registro persistente de qué se ha añadido y qué falta llevar
a código, que sobrevive entre sesiones (a diferencia de la lista de tareas de una conversación).

## 0. Antes de nada

Leer `docs/ampliar-lore-checklist.md` — la sección "Pendiente de código" puede tener trabajo de una
sesión anterior sin cerrar. Mencionarlo si hay algo ahí antes de seguir con lore nuevo.

## 1. El flujo de la sesión

La usuaria da indicaciones de lore (a veces un párrafo denso con varios personajes/eventos/reglas
de golpe). El trabajo, en orden:

1. **Leer primero los `.md` ya existentes que toquen ese tema** (`genesis.md`, `historia.md`,
   `areas.md`, `razas.md`, `npcs.md`, `personajes.md`, `flora-fauna.md`, `items.md`,
   `cronologia-mitica.md`, `cronologia.md`) antes de escribir nada — el lore nuevo casi siempre
   toca algo ya establecido, y a veces ya jugado en partidas reales.
2. **Detectar contradicciones reales contra lo ya escrito y PARAR a preguntar**, no decidir en
   silencio. Ejemplo real de esta sesión: la nueva historia decía que el padre de Gorhorn moría a
   los 10 años de Gorhorn liderando una revuelta; `personajes.md` (ya jugado) decía que moría al
   nacer Gorhorn en un duelo contra el Clan Serhu — y esa segunda versión estaba tejida en la bio
   de un NPC real (Torgash) en `npcs.md`, `areas.md` **y en el catálogo técnico**
   (`worldCatalog.ts`, `loreChunks.ts`). Preguntar cuál se queda ANTES de tocar nada — no asumir.
3. **Cuando la usuaria pida explícitamente proponer algo** (nombres, huecos, etc.), proponerlo con
   el mismo estilo/fonética que el canon ya existente, y presentarlo para aprobación antes de darlo
   por fijado.
4. **Verificar la cronología, no solo la narrativa.** Antes de fijar un "X años después", cruzarlo
   contra `docs/rpgtarkor/cronologia.md` (desde el año 0) o `cronologia-mitica.md` (antes del año
   0). Comprobar en concreto:
   - **Tasas de crecimiento de población** — calcular la tasa anual implícita (`(N/N0)^(1/años)-1`)
     y compararla con lo ya sembrado en `backend/src/scripts/worldPopulation.ts` si el target ya
     existe ahí (esta sesión: casi se reinventó un número que ya estaba puesto y que, de hecho, ya
     cuadraba con la explicación narrativa pedida — comprobar el catálogo ANTES de asumir que hace
     falta inventar o ajustar una cifra).
   - **Generaciones para cambios biológicos/adaptación** — con la esperanza de vida y edad de
     madurez ya establecidas de la raza en cuestión, calcular cuántas generaciones caben en el
     intervalo propuesto y compararlo con referencias reales (adaptación de pigmentación humana:
     ~100 generaciones en el caso más rápido bajo presión extrema, miles en el caso típico). Si el
     intervalo se queda corto, decir cuánto y ofrecer opciones (alargar el intervalo, o justificarlo
     con una regla ya establecida del mundo — aquí, que la magia salvaje acelera la biología orca).
   - Escalas de tiempo puramente políticas/económicas (golpes de estado, hambrunas) no necesitan
     este nivel de escrutinio — décadas son plausibles sin más.
5. **Actualizar todos los `.md` afectados**, no solo el que la usuaria mencionó — un cambio de
   biografía casi siempre toca personajes.md + areas.md + npcs.md a la vez si hay NPCs con bios
   cruzadas.
6. **Registrar en `docs/ampliar-lore-checklist.md`**: qué se escribió (MD, hecho ya) y qué queda
   para cuando se haga la pasada de código (bios de NPCs en `worldCatalog.ts`, chunks RAG en
   `loreChunks.ts` + `npm run reindex-lore`, nuevas criaturas/objetos en el catálogo técnico, etc.)
   — la sesión de lore NO toca código salvo que la usuaria lo pida explícitamente; solo dejarlo
   anotado para la pasada posterior.

## 2. Verificación numérica — cómo, en la práctica

Para cualquier cálculo de tasa/generaciones, usar `python3 -c "..."` vía Bash en vez de estimar de
cabeza — esta sesión encontró un error propio (28 generaciones cuando parecía razonable a ojo,
resultó ser menos que la estimación humana más rápida) que a ojo no se habría visto tan claro.

## 3. Qué NO hacer

- No editar `docs/12-mundo-estructurado.md` como si el pasado se pudiera reescribir — si una
  decisión registrada ahí queda obsoleta, tachar y anotar la revisión con fecha, nunca borrar el
  registro original.
- No tocar código (`worldCatalog.ts`, `loreChunks.ts`, etc.) en la misma sesión salvo petición
  explícita — anotar en el checklist y esperar a la pasada de código.
- No inventar una cifra (población, año) si ya existe una sembrada en el catálogo técnico —
  buscarla primero (`grep` en `backend/src/scripts/`).

---

**Ver también:** [Checklist persistente](ampliar-lore-checklist.md) · [docs/rpgtarkor/](rpgtarkor/)
(todo el lore) · [Revisar partida](revisar-partida.md) (runbook equivalente para auditar partidas
jugadas, no para ampliar lore)
