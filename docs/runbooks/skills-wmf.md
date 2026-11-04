<!-- Sacado de AGENTS.md el 2026-11-02 (aviso de tamaño del doctor); AGENTS.md enlaza aquí. -->
# Las skills del flujo en WMF


Lo propio de WMF que las skills genéricas no dicen (todo en español):

- **Diseño** (`grilling`, `gw-selector`; usuaria, 2026-10-07): toda ronda, también las de detalle, se contrasta con los
  `designReferences` de `.claude/gw.json` buscando cómo lo resuelven (`WebSearch`); **X4 marca el camino** siempre
  que se pueda, y la ronda acaba con las fuentes enlazadas. Si una pregunta pide decidir números o reglas que sobre
  el papel no se sienten, `prototype` con el enlace en esa pregunta. **Toda duda** que se lleve a la usuaria, también
  las `QUESTIONS` de una tanda de pruebas, va contrastada igual, con las fuentes (usuaria, 2026-10-26).
- **`prototype`:** el HTML de lógica se queda en `docs/prototipos/<tarea>-<tema>.html` (no hay rama aparte); el
  veredicto, en la entrada de la tarea en su roadmap con el enlace.
- **`domain-modeling`:** `GLOSSARY.md` es el vocabulario del motor y del producto; el lore canónico vive en
  `docs/rpgtarkor/` y un término de lore se enlaza, no se redefine. ADR en `docs/adr/`.
- **`improve-codebase-architecture` y `retro`:** cada propuesta aceptada entra como tarea con hito en su roadmap.
- **`pr`:** título con los identificadores de las tareas; evidencia con los números de `tsc`, `vitest` y `oxlint` de
  backend y frontend y el test que cubre cada cambio importante; una migración de BD o un cambio de partidas
  guardadas es puerta de un solo sentido.
- **`gw-orchestrate-dealer`:** el encargo apunta a la fila de la bitácora, el P-número del registro, la fila de la
  matriz y la función de `docs/mapa-agente.md`. Antes de repartir una tanda, la principal comprueba que el escenario
  da el estado que pide cada id (montura, lugar visitado, animal, convaleciente…); si falta, el primer trozo lo
  prepara (`QA-216`). Una tanda de juego, 6-8 hallazgos y ~60 llamadas; una de arreglos, como mucho 5
  hallazgos y ~90 llamadas, y la revisión con Opus junta dos tandas (`QA-257`). Al llegar la de juego,
  `tools/qa/escenario.sh guardar` y la siguiente lo carga (`QA-147`); si el encargo escribe en la partida, se prueba
  con `escenario.sh probar` (`QA-153`) y pasa por las funciones del juego que aplican esas reglas, sin rehacerlas a
  mano (`QA-151`). Los P-números de `FOUND` van al registro de la ronda y los de `TOOLS` a
  [`fallos-herramientas.md`](../records/fallos-herramientas.md) (`QA-133`); con subagentes en paralelo, solo la
  principal escribe la bitácora y `docs/records/pruebas-0.3-hallazgos.md` (`QA-132`).
- **`gw-opt-ai` y `gw-scout-updates`:** lo de WMF (Ollama real, `tools/qa/bench-ia.sh`, perfiles de la Deck) está en
  `.claude/gw/gw-opt-ai.md` y `.claude/gw/gw-scout-updates.md` (la memoria del scout sigue en `docs/scout/`); `gw-opt-tokens`, en `.claude/gw/gw-opt-tokens.md`.
