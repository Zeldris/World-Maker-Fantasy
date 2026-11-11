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
  prepara (`QA-216`), con una consulta de `tools/qa/sql.sh` por id cuya salida va en el encargo (`QA-316`). La tanda local
  acaba con `tools/qa/deck/ia-ronda.sh parar` (`QA-313`). El encargo de código pide importar la lógica que imite de
  otro módulo (o decir por qué no se pudo, `QA-314`), correr los tests con
  `bash tools/qa/tests-vitest.sh unidad|integracion <archivos>` y devolver la salida de `red-without-fix.sh` de cada
  test nuevo (`QA-315`). Una tanda de juego, 6-8 hallazgos y ~60 llamadas; una de arreglos, como mucho 5
  hallazgos y ~90 llamadas, y la revisión con Opus junta dos tandas (`QA-257`). El encargo lleva «a las 50 llamadas, para, guarda el escenario y devuelve lo hecho y lo que falta» (`QA-304`). Al llegar la de juego,
  `tools/qa/escenario.sh guardar` y la siguiente lo carga (`QA-147`); si el encargo escribe en la partida, se prueba
  con `escenario.sh probar` (`QA-153`) y pasa por las funciones del juego que aplican esas reglas, sin rehacerlas a
  mano (`QA-151`). Los P-números de `FOUND` van al registro de la ronda y los de `TOOLS` a
  [`fallos-herramientas.md`](../records/fallos-herramientas.md) (`QA-133`); con subagentes en paralelo, solo la
  principal escribe la bitácora y `docs/records/pruebas-0.3-hallazgos.md` (`QA-132`). El encargo de arreglos
  dice «deja el cambio sin commitear» (la principal lo commitea con la bitácora) o, si trabaja en su propia rama,
  «actualiza tu fila con `handoff.py` y commitéala en el mismo commit»: un commit sin `traspaso.md` lo pide el
  gancho de parada y el `--amend` lo bloquea el modo automático (`QA-319`).
- **`/gw-update`** (`QA-296`): la comparación entre la copia de WMF y la versión nueva (cada `.gw-new`, cada
  archivo del flujo con desvío local, que `--update` sobrescribe sin `.gw-new`, y los rellenados como `REVIEW.md`)
  la hace un subagente Sonnet que devuelve la tabla «archivo · desvío · arriba · decisión propuesta»; la sesión
  principal solo decide. La tabla se guarda en `docs/records/propuestas-flujo.md` (sección de la versión), no en la
  conversación. Tras aplicar, `doctor.py`, `apply.py --check` y los tests (`tools/qa/tests` y los
  `.claude/skills/*/scripts` de `ci.yml`). La fase 1 de esa rama, en el
  [paso 6 de `skills-y-modelos.md`](skills-y-modelos.md#cómo-se-usa-el-flujo-de-una-tarea) (`QA-294`).
- **`gw-opt-ai` y `gw-scout-updates`:** lo de WMF (Ollama real, `tools/qa/bench-ia.sh`, perfiles de la Deck) está en
  `.claude/gw/gw-opt-ai.md` y `.claude/gw/gw-scout-updates.md` (la memoria del scout sigue en `docs/scout/`); `gw-opt-tokens`, en `.claude/gw/gw-opt-tokens.md`.
