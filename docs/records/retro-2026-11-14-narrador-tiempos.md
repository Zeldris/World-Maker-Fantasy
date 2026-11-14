# Retro de `claude/narrador-tiempos` (`QA-289`, rondas 3-5d), 2026-11-14

**Estado:** sin decidir.

Fuentes: las sesiones de la rama del 2026-11-14 (`2f0a9763` rondas 3-5, `94e5ad6a` merge de `main` y revisión de
bloque, `273a363a` `/gw-opt-tokens`). El gasto ya lo cubrió `/gw-opt-tokens` (~~`QA-342`~~, ~~`QA-343`~~) y la
calidad del narrador, `/gw-opt-ai` (`QA-339`…`QA-341`); aquí, solo lo que queda fuera de los dos.

## Candidatos, de más a menos grave

### P1 · El ledger de métricas se une solo al traer `main` (medio, proyecto)

Al traer `main` (`05eedd1c`), `docs/metrics/ledger.jsonl` quedó en conflicto junto a los roadmaps y la bitácora, y el
primer commit del merge falló («unmerged files»). El ledger solo crece por el final, una línea JSON por sesión: con
`merge=union` git junta las dos colas sin conflicto. Cambio: `.gitattributes` con
`docs/metrics/ledger.jsonl merge=union`. Riesgo: ninguno para un archivo de solo añadir.

### P2 · El lint del proyecto es `oxlint`, no `eslint` (leve, proyecto)

En la ronda 5 se lanzó `npx eslint src/...` en `backend/`: npx instaló eslint 10, que no encontró configuración y
falló; el lint del proyecto es `npm run lint` (`oxlint`). Cambio: en `docs/mapa-agente.md`, junto a las órdenes de
comprobar, una línea «lint: `npm run --silent lint` (oxlint) en `backend/` o `frontend/`; nunca `npx eslint`».

### Sin cambio

- El pre-push con los tests relacionados paró un push en el que P419 rompía el caso mixto de P306
  (`turn.integration.test.ts`): el guardarraíl funcionó.
- Las tres interrupciones del `/code-review` fueron de la usuaria (cambio de tarea), no un fallo de la skill.

## For Galivelop-workflow

- **G1 · El gancho Stop cuenta como «sin subir» los commits de `main` traídos por merge.** Tras traer `main` dijo
  «323 commits not pushed», casi todos ya en `origin/main`. Contar solo los que no están en ningún remoto
  (`git rev-list HEAD --not --remotes`) da la cifra real.
- **G2 · `merge=union` para el ledger en la plantilla del flujo.** Lo de P1 vale para cualquier proyecto con
  `docs/metrics/ledger.jsonl`: que `gw-init`/`gw-update` añada la línea a `.gitattributes`.
