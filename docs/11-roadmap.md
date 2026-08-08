# Roadmap — Tarkor (auditoría, 2026-07-18)

**Actualización (2026-08-07):** el catálogo de Profesiones (único pendiente real que quedaba del
punto de abajo, aparte del benchmark de `llama3.2` y las líneas pausadas) queda cerrado — ver
[09-panel-personaje.md](09-panel-personaje.md) § 8 y la memoria del rediseño (recolectoras vs
creadoras, capacidad de inventario real, `docs/16-poblacion-dinamica.md` § 3.5 para el pop-up de
recolección). Misma sesión: auditoría de código completa (back+front) con 5 bugs reales
arreglados y un candado de turno nuevo que cierra dos condiciones de carrera del motor de turnos.

**Actualización (2026-08-03):** población dinámica implementada — ver
[16-poblacion-dinamica.md](16-poblacion-dinamica.md). `WorldPopulation` (sembrado desde 2026-07-29,
nunca leído hasta ahora) ya depleciona de verdad al morir un NPC (fauna o raza, incluidos los NPC
con nombre propio) y se repuebla con el tiempo real (tasa distinta fauna/raza, umbral mínimo de
reproducción, sin techo duro por ahora); los encuentros ambientales se ponderan por esa población
real y se filtran por región activa, en vez de un azar uniforme sobre toda la fauna del mundo.
Pendiente, aplazado a propósito por la usuaria: guerra/caza dinámica del entorno/otros eventos de
mundo que también reduzcan población sin intervención directa de la jugadora (fase 2).

**Actualización (2026-08-02):** repasado archivo por archivo junto con el resto de `docs/*.md` a
petición de la usuaria ("actualiza los .md") — de todo lo listado abajo, solo quedan genuinamente
abiertos: el benchmark de `llama3.2` (3B, punto 12), el catálogo de Profesiones (ver
`docs/09-panel-personaje.md` § 8), y las líneas explícitamente pausadas (Multijugador, lore de los
otros 7 personajes, Reino). Todo lo demás de este documento ya está hecho — se deja tachado por
historial, no como pendiente real. El detalle vivo de bugs encontrados jugando vive ahora en
`docs/revisar-partida-hallazgos.md`, no aquí.

**Actualización (2026-07-19): roadmap consolidado más reciente vive en memoria, no en este archivo.** Tras esta auditoría se hicieron 5 pasadas más con Fable (calibración de combate, NpcState/Salud, mecánicas de juego orientadas a "ponérselo fácil a la IA", y velocidad/latencia), fusionadas en un único orden de prioridad — ver la memoria `project-tarkor-roadmap-final` (o preguntar a Claude por "el roadmap final consolidado"). Alcance fijado ese día: **centrarse en 1h de partida jugable con exploración y combate; Reino/gobierno queda pausado.** Todo lo de abajo sigue siendo historial correcto de lo cerrado hasta el 2026-07-18.

**Estado:** documento vivo. Nace de una auditoría de solo lectura sobre todo el proyecto (código, esquema, docs, git) tras cerrar la primera gran tanda de mecánicas (niveles/XP, Reino, acciones por tiempo, habilidades). Se actualiza según se cierren o aparezcan puntos.

**Redirección importante (2026-07-18, misma sesión, después de escrito este documento):** la usuaria pidió explícitamente **no** ampliar el lore de los otros 7 personajes/Vaelira por ahora ("olvídalos, que no salgan en el juego todavía") — el § 0 de abajo queda en pausa. En su lugar se abrió una línea de trabajo mucho más grande, centrada solo en el mundo de Gorhorn: **[12-mundo-estructurado.md](12-mundo-estructurado.md)** (posición real por grafo, NPCs con stats fijos, fauna/flora → recursos, armería con loot determinista), **[13-escala-del-mundo.md](13-escala-del-mundo.md)** (dimensiones reales en km, solo referencia editorial) y **[14-combate-y-muerte.md](14-combate-y-muerte.md)** (condición física, combate por turnos en popup, revelado progresivo, sistema de muerte/descanso con la Entidad Desconocida).

**Actualización (2026-07-18, sesión posterior): `docs/12` implementado y verificado en vivo** — ver su § 7 para el detalle completo. `docs/13` sigue siendo solo referencia editorial (no bloquea nada de código).

**Actualización (2026-07-18, misma sesión, continuación): `docs/14-combate-y-muerte.md` también implementado** — ver su § 6. Condición física, combate en popup, revelado progresivo y muerte/respawn con la Entidad Desconocida, verificados en profundidad: el flujo de muerte/respawn (game over y respawn con aviso) se verificó de verdad replicando el bloque de `turnResolution.ts` contra la DB real (sin depender de que Ollama devuelva "MUERTO"), y el flujo de combate (`enCombate`, escalado de condición física) se verificó con turnos reales — un primer intento chocó con el cuelgue intermitente ya conocido del motor de gramática de Ollama (no relacionado con estos cambios), un reintento idéntico funcionó perfectamente. Con esto, **las tres líneas de trabajo grandes abiertas la sesión anterior (`docs/12`, `docs/13`, `docs/14`) quedan cerradas**.

**Actualización (2026-07-18, misma sesión, continuación): secciones 2 y 3 de este roadmap también cerradas.** Agenda del mundo (decisión: no se construye, superseded por `/entorno`), Misiones (`Quest` implementado y verificado), `SessionSummary`/capítulos automáticos (implementado y verificado) y tests automatizados (51 tests con vitest) — todos hechos. Solo quedan abiertos: validar `reino_events` jugando de verdad, benchmark de `llama3.2` como Cronista, y las 12 preguntas de Multijugador (pausadas a propósito).

---

## 0. Pausado: ampliar el lore de los otros 7 personajes

Confirmado por auditoría (`backend/src/scripts/loreChunks.ts`, 41 fragmentos totales): el corpus está muy desequilibrado hacia Gorhorn.

- **Berig / Llanuras del Viento Rojo (Gorhorn)**: ~20 de 41 fragmentos (~50%) — 12 tageados `llanuras`, los 4 `CLAN` (todos orcos), el `PERSONAJE` dedicado a Gorhorn con inventario/aspecto/trasfondo detallado, y 5 de los 6 `GANCHO`.
- **Vaelira + los otros 7 personajes**: solo ~5-6 fragmentos — Vaelira tiene un resumen de continente, flora, fauna y un chunk de NPCs; **los 7 personajes comparten un único chunk combinado** ("Los otros 7 personajes pregenerados", una frase cada uno, sin detalle individual ni ganchos de aventura propios).

Es coherente con que Gorhorn es el único personaje jugado hasta ahora, pero en cuanto se juegue con cualquiera de los otros 7 (Sael, Dessa, Ithren, Amonir, Yerin, Riko, Cassia), el Narrador tendrá muy poco con qué no inventar. Tarea concreta cuando toque: darle a cada uno de los 7 un chunk `PERSONAJE` propio (como el de Gorhorn) + 2-3 `GANCHO` de aventura específicos de su región/trama, siguiendo el mismo patrón que ya funcionó para Gorhorn (vocabulario de jugador, no solo descripción enciclopédica — lección ya aprendida y verificada con distancias de recuperación reales).

---

## 1. Rápidos y de bajo riesgo — **todos hechos** (2026-07-18)

1. ~~Borrar código muerto~~ — hecho, `generateCharacterResponse`/`generateWorldEvent`/`worldEventPool` eliminados de `simulateAI.ts`.
2. ~~`.gitignore` en la raíz~~ — hecho.
3. ~~Primer commit~~ — hecho: 18 commits (v0.1→v0.8), subidos a `origin/main`.
4. ~~Prompt de `classifyAction`~~ — hecho: añadidos ejemplos few-shot completos y regla de prioridad de duración explícita. **Sigue sin validarse en juego real** que esto haya arreglado la fiabilidad de `banda` — pendiente de confirmar jugando.

**Nuevo hallazgo de una partida real jugada (no estaba en la auditoría original):** los ganchos de `/entorno` se apilan sin resolver si la jugadora no responde a tiempo — cada tick de 5 min lanza uno nuevo sin comprobar si el anterior sigue sin respuesta. Arreglo aislado, no depende de `docs/12`: no inyectar un evento nuevo en el log de personaje si el último sigue sin contestar.

## 2. Mecánicas pendientes de cerrar

5. ~~**Condición física**~~ — **hecho** (2026-07-18): implementada junto con el resto de [14-combate-y-muerte.md](14-combate-y-muerte.md) (combate, muerte, descanso).
6. ~~**`WorldState.agenda` nunca se resuelve**~~ — **decisión tomada (2026-07-18)**: no se construye. El panel "El mundo" (`entorno.ts`) ya cubre esa necesidad con ambientación periódica + evento probabilístico (25%), y nada ha escrito nunca en `agenda`. Construir un resolutor para una cola sin productor no aporta nada — el campo queda reservado sin uso hasta que exista contenido real de agenda que justificarlo (ver comentario ampliado en `worldTick.ts`).
7. ~~**Misiones**~~ — **hecho** (2026-07-18): modelo `Quest` nuevo (mismo patrón que Reino — `newQuest`/`questProgress` en `narrador.ts`, materializado en `turnResolution.ts`), `MisionesPanel.tsx` en el frontend. Verificado en vivo (crear + consultar).
8. **Validar `reino_events` con Ollama de verdad** — pendiente 8 del diseño de niveles/Reino (`docs/10-niveles-xp-reino.md`): confirmar jugando si el modelo local devuelve `newTerritory`/`newBuilding`/`newSubject` con fiabilidad razonable, o si hace falta el plan B (crear filas de Reino a mano).

## 3. Higiene técnica, sin prisa

9. **`PregeneratedCharacter` sin usar** — **decisión tomada (2026-07-18, preguntado a la usuaria): se deja como está.** No se usa hoy, pero tampoco molesta; si el juego se amplía a los otros 7 personajes ya está listo sin otra migración.
10. ~~**`SessionSummary` sin usar**~~ — **hecho** (2026-07-18): `backend/src/services/chapterSummary.ts` — cada 15 acciones del jugador el backend (no el modelo) resume el capítulo con el Cronista y dispara el hito `capitulo` determinista (500 XP). Verificado en vivo con 15 acciones reales sembradas: resumen coherente y anclado, y confirmado que no se dispara dos veces sin acciones nuevas. `DiarioPanel.tsx` muestra los capítulos.
11. ~~**Cero tests automatizados**~~ — **hecho** (2026-07-18): `vitest` instalado, 51 tests sobre los servicios puros (`progression.ts`, `worldFacts.ts`, `travel.ts`, `death.ts`, `chapterSummary.ts`) — incluye una regresión explícita del bug real de "voy hacia" encontrado en la verificación de `docs/12`. `npm test` en `backend/`.
12. Benchmark pendiente de `llama3.2:latest` (3B) como Cronista/fallback — nunca medido explícitamente.

## 4. Pausado a propósito (no tocar todavía)

- Las 12 preguntas del modo Multijugador (`docs/02-decisiones.md`, P0-P3) — explícitamente pausadas hasta que el modo en solitario esté maduro.

---

## Pendiente de decidir contigo

- Orden de prioridad entre las secciones 1-3 (recomendación: sección 1 primero, es barata y de bajo riesgo).
- Si quieres que el primer commit de git se haga ya o se deja para cuando el proyecto esté en un punto más "cerrado".
