# Retro 2026-11-03 · `claude/wonderful-volta-662qt8`

**Sesión:** nube, del 2026-10-26 al 2026-11-03. Ronda de la puerta (paso 3.3,
[plan](plan-comprobacion-puerta.md)): tandas 38-82, arreglos hasta P409, preparación `QA-262`…`QA-270`. 152 commits
sobre `main`. Revisión antes de `main`: 10 candidatos, 1 arreglado (rival huido en escena), 7 leves a la bitácora.

**Estado:** las tres aprobadas por la usuaria (2026-11-03). Las tres aplicadas en la rama: `QA-290`, `QA-291` y
`QA-292`.

## Candidatas, de más a menos grave

1. **Números de tarea ya usados en `main`** (comprobación). La rama numeró tareas mirando solo su copia y tuvo que
   renumerar dos veces (`621a343c`: QA-259→263; `65839774`: →268). Al probar el arreglo, `QA-288` y `QA-289` ya
   estaban en `claude/narrador-tiempos`. Propuesta: `tools/roadmap/siguiente-id.py <serie>`, que mira la copia y
   todas las ramas remotas; puntero en `AGENTS.md` («Ninguna tarea sin hito»).
2. **Fallos del driver de pruebas que cuestan tandas** (comprobación). P400, P407 (dos veces) y P409 eran de
   `escenario.sh`, la recarga del driver o `estado.js`, no del juego; los tests de `test_escenario.py` usan un driver
   falso. Propuesta: una prueba de humo con el juego y el driver reales (cargar, recargar y leer el HUD) en la CI.
3. **Una sola revisión de 152 commits deja partes sin mirar** (revisión). El `/code-review` antes de `main` avisó
   de que no miró a fondo `cronista/prepar*`, `companionSupervivencia`, `progresionPersonaje` ni `combatGroups`.
   Propuesta: en una rama larga, adelantar la fase 1 al cerrar cada bloque de ~10 tandas, solo del diff nuevo.

## Gasto (`opt-tokens`)

Esta sesión, tras el `/clear`: 16 llamadas, 94k de contexto medio, sin compactar; la revisión del código, 1,5M de
entrada en su subagente, tanto como la sesión. Las sesiones anteriores de la rama no se pueden medir desde este
contenedor. Sin propuesta de gasto aparte: la 3 abarata la revisión final.
