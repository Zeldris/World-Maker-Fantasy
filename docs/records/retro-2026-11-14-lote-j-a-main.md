# Retro: tandas 126-130 y lote J, a `main` (2026-11-14)

Rama `claude/wonderful-volta-662qt8`, desde `19d8c52`: 69 commits. Tandas 126-130, arreglos P460-P463 y P107,
revisión de bloque con 7 hallazgos y otra de cierre sin hallazgos. Gasto medido con `/gw-opt-tokens`: 221 llamadas en
la principal, contexto medio de 111k (suelo de 93k, techo de 141k), y 90 llamadas en subagentes (dos `gw-worker`
`sonnet` y el `/code-review` con opus).

**Estado:** aprobada entera por la usuaria (2026-11-14). R2 y R3 aplicadas en esta rama; R1 y R4, apuntadas para el
flujo.

## Candidatas, de más a menos grave

- **R1 (grave, flujo).** El subagente de los arreglos dio por «preexistente» un fallo de `turn.integration`
  («Desaparición de un cadáver») que había causado su propio lote (P461 conserva el `NpcState` con `muerto: true`).
  El `branchCheck` no corría ese test, y nadie lo probó en `origin/main`. Se vio en la revisión de la principal y se
  arregló en el commit siguiente.
- **R2 (media, proyecto, aplicada).** La revisión del bloque tuvo 7 hallazgos: sobre todo lectores de cadáveres que
  no sabían de `muerto: true`. «Combate» de `docs/mapa-agente.md` lista ahora quién lee los cadáveres.
- **R3 (media, proyecto, aplicada como tarea).** P184 no se puede comprobar en la nube: «Viajar» solo lista lo
  visitado. Queda `QA-337` (escenario con el Poste del Clan Serhu visitado) para la siguiente sesión de arreglos.
- **R4 (leve, flujo).** 22 lecturas de `traspaso.md` (759k arrastrados), casi todas para ver la propia fila tras
  `handoff.py set-row`.

## Para Galivelop-workflow

- **R1:** en `gw-orchestrate-dealer`, el encargo de un subagente dice que un test en rojo solo es «preexistente» si
  falla igual en la rama protegida (`git stash`/worktree en `origin/main` y el mismo test), y que lo diga con la
  salida de las dos corridas. La principal lo comprueba antes de aceptarlo.
- **R4:** `handoff.py set-row` y `close-row` imprimen la fila resultante y su tamaño frente al límite, para que no
  haga falta `git diff` ni `grep` sobre la bitácora.
