# Roadmap — Tarkor (auditoría, 2026-07-18)

**Estado:** documento vivo. Nace de una auditoría de solo lectura sobre todo el proyecto (código, esquema, docs, git) tras cerrar la primera gran tanda de mecánicas (niveles/XP, Reino, acciones por tiempo, habilidades). Se actualiza según se cierren o aparezcan puntos.

---

## 0. Fijo en el roadmap: ampliar el lore

Confirmado por auditoría (`backend/src/scripts/loreChunks.ts`, 41 fragmentos totales): el corpus está muy desequilibrado hacia Gorhorn.

- **Berig / Llanuras del Viento Rojo (Gorhorn)**: ~20 de 41 fragmentos (~50%) — 12 tageados `llanuras`, los 4 `CLAN` (todos orcos), el `PERSONAJE` dedicado a Gorhorn con inventario/aspecto/trasfondo detallado, y 5 de los 6 `GANCHO`.
- **Vaelira + los otros 7 personajes**: solo ~5-6 fragmentos — Vaelira tiene un resumen de continente, flora, fauna y un chunk de NPCs; **los 7 personajes comparten un único chunk combinado** ("Los otros 7 personajes pregenerados", una frase cada uno, sin detalle individual ni ganchos de aventura propios).

Es coherente con que Gorhorn es el único personaje jugado hasta ahora, pero en cuanto se juegue con cualquiera de los otros 7 (Sael, Dessa, Ithren, Amonir, Yerin, Riko, Cassia), el Narrador tendrá muy poco con qué no inventar. Tarea concreta cuando toque: darle a cada uno de los 7 un chunk `PERSONAJE` propio (como el de Gorhorn) + 2-3 `GANCHO` de aventura específicos de su región/trama, siguiendo el mismo patrón que ya funcionó para Gorhorn (vocabulario de jugador, no solo descripción enciclopédica — lección ya aprendida y verificada con distancias de recuperación reales).

---

## 1. Rápidos y de bajo riesgo (hacer ya)

1. **Borrar código muerto**: `generateCharacterResponse` y `generateWorldEvent` en `frontend/src/lib/simulateAI.ts` (con su `worldEventPool`) — restos del simulador previo a conectar Ollama de verdad. Nada las usa. Solo `playerActionEntry` sigue viva.
2. **`.gitignore` en la raíz** — hoy no existe (solo hay uno dentro de `backend/` y otro dentro de `frontend/`). Importante antes del primer commit para no trackear `debug/` (los volcados de depuración) ni artefactos sueltos.
3. **Primer commit** — el repositorio tiene `.git` pero **cero commits** ("On branch main — No commits yet"). Todo el trabajo de este proyecto no tiene ningún punto de recuperación. Merece decidir contigo cuándo hacerlo (¿un commit grande de "estado actual" o trocearlo en varios commits temáticos?).
4. **Prompt de `classifyAction` — arreglar `banda`/`duracionEstimadaMinutos`**: causa raíz ya identificada. El prompt (`backend/src/services/narrador.ts`) da ejemplos por *tipo de actividad* pero nunca instruye a leer expresiones explícitas de duración en el texto del jugador ("varios días", "toda la noche"), no exige coherencia entre `banda` y `duracionEstimadaMinutos`, y no tiene ningún ejemplo few-shot completo — frágil para el modelo pequeño que lo resuelve. Arreglo concreto: añadir 2-3 ejemplos completos entrada→salida y una regla explícita de "si el jugador menciona una duración, tiene prioridad sobre tu estimación por tipo de acción".

## 2. Mecánicas pendientes de cerrar

5. **Condición física** — decidida desde hace tiempo (`ileso→herido→grave→incapacitado→muerto`, decisión de mecánicas 3) pero **nunca añadida al schema**. `Save` no tiene ningún campo de salud hoy. Sigue siendo pendiente real, no solo documentación desfasada.
6. **`WorldState.agenda` nunca se resuelve** — se inicializa vacío y ahí se queda; el worker (`worldTick.ts`) solo resuelve `CharacterTransit`, no agenda de facciones/NPCs. Es un TODO explícito en el propio código (línea 17-18).
7. **Misiones** — la única pestaña placeholder que queda de las 9 del panel de personaje. Necesita un modelo `Quest` nuevo.
8. **Validar `reino_events` con Ollama de verdad** — pendiente 8 del diseño de niveles/Reino (`docs/10-niveles-xp-reino.md`): confirmar jugando si el modelo local devuelve `newTerritory`/`newBuilding`/`newSubject` con fiabilidad razonable, o si hace falta el plan B (crear filas de Reino a mano).

## 3. Higiene técnica, sin prisa

9. **`PregeneratedCharacter` sin usar** — la tabla existe en el schema pero nunca se siembra ni se lee desde el backend; los 8 personajes viven solo en `frontend/src/data/mock.ts`. Funciona así, pero es una asimetría rara (una tabla entera del schema sin ningún uso real). Decidir si se sembraría alguna vez o si se debería quitar del schema.
10. **`SessionSummary` sin usar** — el modelo de "resumen por capítulos" (memoria a largo plazo para partidas largas) existe en el schema pero nunca se crea. Se mencionó en el diseño de XP como fuente del hito `capitulo` automático, pero esa pieza no está conectada todavía.
11. **Cero tests automatizados** — confirmado, no hay ningún `*.test.ts` ni test runner instalado, solo scripts manuales de terminal (`test-turn.ts`, `test-retrieval.ts`, `test-worldtick.ts`). Para un proyecto de este tamaño no es urgente, pero `backend/src/services/progression.ts` y `worldFacts.ts` (funciones puras, sin IA) serían los candidatos más baratos y de más valor si en algún momento se quiere empezar.
12. Benchmark pendiente de `llama3.2:latest` (3B) como Cronista/fallback — nunca medido explícitamente.

## 4. Pausado a propósito (no tocar todavía)

- Las 12 preguntas del modo Multijugador (`docs/02-decisiones.md`, P0-P3) — explícitamente pausadas hasta que el modo en solitario esté maduro.

---

## Pendiente de decidir contigo

- Orden de prioridad entre las secciones 1-3 (recomendación: sección 1 primero, es barata y de bajo riesgo).
- Si quieres que el primer commit de git se haga ya o se deja para cuando el proyecto esté en un punto más "cerrado".
