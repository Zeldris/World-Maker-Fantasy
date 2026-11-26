# Retro · PR de `claude/wonderful-volta-662qt8` (QA-530, QA-531, QA-532, QA-540)

**Estado:** aprobada por la usuaria (2026-11-26) entera: R4 aplicada en este PR; R1-R3 al roadmap 0.7 como QA-541, QA-542 y QA-543; las dos de Galivelop-workflow, apuntadas abajo para `gw-harvest`.

Fuentes: la sesión (206 llamadas desde 2026-11-25 20:02 UTC, 4 compactaciones), `task.py deviations`,
`/gw-opt-tokens` (aplicado como `QA-540`).

## Propuestas, por gravedad

1. **R1 · Dos tests de `tools/qa/tests` en rojo en el contenedor de la nube** (proyecto, comprobaciones).
   `test_ci_local_mock…test_trap_mata_el_mock_que_lanza` y `test_ia_ronda…test_parar_mata_el_proceso_y_sus_hijos_y_para_el_juego`
   fallan con «ProcessLookupError not raised» también en `origin/main`. Un rojo de base tapa los rojos de verdad.
   Propuesta: tarea nueva que los haga deterministas (esperar al proceso hijo antes de comprobar que murió).
2. **R2 · El umbral de `/gw-opt-ai` se juzgó sin leer la tabla** (proyecto, comprobaciones). La sesión recomendó
   `/gw-opt-ai` por «PR a `main`» con «Sin analizar» vacía. Propuesta: `tools/qa/opt-ai-pendiente.py` que sale con 1
   solo si hay filas sin analizar y pasan el umbral; la fase 2 de `skills-wmf.md` lo nombra.
3. **R3 · `siguiente-id.py` se colgó en un subagente** (proyecto, herramientas, `QA-290`). El subagente usó
   `cobertura.py --libre`, que no mira las ramas remotas; la sesión tuvo que buscar cada id a mano. Propuesta:
   diagnosticar el cuelgue y ponerle un `timeout` a cada consulta remota, con un test.
4. **R4 · `AGENTS.md` dice `--agent <skill|sesión>`, pero `task.py` solo acepta `session`** (proyecto, no-op que
   cuesta una llamada). Propuesta: cambiar la palabra.

## For Galivelop-workflow

- **scope-guard mira la marca de tarea, no el `Refs:` del commit.** Una tarea nueva cerrada dentro del PR (`QA-540`)
  dio 8 avisos falsos dos veces (el `pre-commit` corre antes que el mensaje, y la marca solo la cambia la usuaria).
  Propuesta: si la ficha de una tarea nueva entra en el mismo commit, usar su `## Files`.
- **El log de decisiones acepta `pending` o un sha, no `done`**, y `task.py log` no dice qué valores vale ese campo.
  Propuesta: que la plantilla lo diga en un comentario.
