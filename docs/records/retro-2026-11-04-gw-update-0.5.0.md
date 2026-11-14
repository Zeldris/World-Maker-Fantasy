# Retro — `/gw-update` v0.4.3 → v0.5.0 (2026-11-04)

Rama `claude/gw-update-0.5.0`, commits `839a3b84`..`de60c5dc`. El gasto ya lo midió `/gw-opt-tokens` (`QA-294`,
`QA-295`, en `.claude/gw/gw-opt-tokens.md`); esta retro mira el resto: navegación, comprobaciones y skills.

**Estado:** aprobadas las tres (usuaria, 2026-11-04). R1 aplicada en la rama (`QA-296`); R2 y R3 propuestas a
Galivelop-workflow (P19 y P18 de `propuestas-flujo.md`).

## Propuestas, de más a menos grave

### R1. La regla de reconciliar con un subagente, donde se lee al actualizar (navegación, de WMF)

La R3 de la retro del 2026-11-02 (la comparación `.gw-new` contra la copia de WMF la hace un subagente Sonnet que
devuelve la tabla «desvío · arriba · decisión») no se aplicó: vive en `.claude/gw/gw-opt-tokens.md`, que solo se lee
al hacer `/gw-opt-tokens`, no al lanzar `/gw-update`. La sesión principal leyó ella misma el diff de `AGENTS.md`
(21k, y otra vez 14k tras compactar), `REVIEW.md` entero (14k), el `CHANGELOG` (16k) y la salida del `--dry-run`
(22k): dos compactaciones en los primeros 12 minutos. Solo el barrido de nombres fue a un subagente.
Cambio: una entrada `/gw-update` en `docs/runbooks/skills-wmf.md` con las dos reglas (reconciliación por subagente y
fase 1 sin las copias, `QA-294`), y en `gw-opt-tokens.md` se queda solo como coste conocido. Coste: dos líneas.

### R2. `/gw-update` que reparte la reconciliación por sí sola (economía, para Galivelop-workflow)

Lo de R1 vale para cualquier proyecto con desvíos locales, y ya van dos actualizaciones con el mismo patrón
(R2 de la retro del 2026-11-02). Cambio en el flujo: que la skill `gw-update` mande la comparación de cada `.gw-new`
a un subagente barato que devuelva la tabla, y que la fase 1 de una rama de actualización deje fuera las copias
idénticas del flujo (`QA-294`), comprobadas con `doctor.py` y los tests. Va a `## For Galivelop-workflow`.

### R3. `apply.py --check` en verde con un archivo propio declarado (comprobación, para Galivelop-workflow)

`apply.py --check` sale con 1 para siempre porque `.githooks/commit-msg` es de WMF a propósito (decisión de la
usuaria, P18): una comprobación que siempre está en rojo deja de mirarse y esconde el siguiente fallo de verdad.
Cambio en el flujo: una clave de `gw.json` (p. ej. `ownedFiles`) con los archivos del flujo que el proyecto ha hecho
suyos; `--check` los da como «propios» y sale con 0. Hasta entonces, la excepción sigue apuntada en la bitácora.

## Las skills en esta tarea

- `gw-selector`: eligió bien skill y modelos (Sonnet para el barrido), pero no recordó la R3 anterior: lo arregla R1.
- `/code-review` (fase 1): revisó las 326 rutas, el 89 % copias del flujo; ya corregido con `QA-294`.
- `gw-opt-tokens`: midió y propuso bien; sus dos propuestas se aplicaron.

## For Galivelop-workflow

- R2 (P19) y R3 (P18), con P16 y P17 de `docs/records/propuestas-flujo.md`.
