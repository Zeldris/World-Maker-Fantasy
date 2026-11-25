# Retro: generadores en cada hito, `QA-528` (`claude/wonderful-volta-662qt8`, 2026-11-25)

La fase 1 dio 0 hallazgos. El código son dos líneas de `tools/roadmap/cobertura.py` (MAP), y `cobertura.py` sale en
verde. El resto es contenido: 21-roadmap, los roadmaps de imágenes, mapas y voces, el plan 0.3 y mapa-agente.

## Propuestas

- **P1 · Bucle de compactación: el arranque fijo sigue siendo la mayor palanca** (del proyecto, lo hace la usuaria).
  Llevamos 75 compactaciones en esta sesión, y el gancho saltó con la alarma de bucle. El arranque son ~101k tokens,
  el 63 % del corte, y ~84k son sistema (herramientas y MCP). Es la P2 de la retro del 2026-11-24, todavía sin
  hacer: desconectar en claude.ai el conector Claude Docs, que aquí no se usa. Riesgo: ninguno si se dejan GitHub y el
  remoto.
- **P2 · Barrido de `tools/roadmap/resolver-conflicto.py`** (del proyecto, `QA-529`, para cuando se vuelva al
  roadmap). Es el script con más leves abiertos en `pendientes-leves.md`, tres:
  - busca los marcadores por texto exacto;
  - tiene dos parsers distintos de los de `tools/qa/resolver_hallazgos.py`;
  - es manual (valorar un driver `merge=roadmap`).

  `iaRegistro.ts` tiene dos, pero ya los cubre `QA-520`. Hay un cuarto leve, en `.gitattributes` (`merge=union`
  duplica el ledger): entra si se elige el driver. Con el entorno congelado, solo si la usuaria lo aprueba.
- **P3 · La fila de una rama, al día en `main` tras su PR** (del proyecto). El cierre de la fila de
  `claude/ronda-local-2` (`72454dd7`, «PR #104 fusionado») se subió a la rama después de fusionar, y `main` sigue
  diciendo «PR abierto». Arreglo: corregir esa fila en este PR (`GW_SHARED_LOG=1`). La regla de `close-row` antes
  del PR ya existe: el fallo fue escribir después de fusionar.

## For Galivelop-workflow

- **G1 · El guardia de alcance avisa de archivos que sí están en `## Files`**. `task.py deviations` lista
  `commit-warn` en `roadmap-imagenes.md`, `roadmap-mapas.md`, `roadmap-voces.md`, `plan-roadmap-0.3.md` y
  `21-roadmap.md`, y los cinco están en la ficha de `QA-528`. La ficha se creó en el mismo commit (`4f2ffbde`), lo
  que puede explicar los de las 20:12, pero no el de las 20:54. Propuesta: que el guardia lea `## Files` del árbol
  del commit en curso y un test que lo cubra.
- **G2 · El gancho Stop de «cambios sin commit» choca con «no hay commit solo para el ledger»**. Saltó dos veces en
  esta sesión por `docs/metrics/ledger.jsonl` solo. Si el gancho es del flujo, que ignore el ledger; si es del
  entorno remoto, apuntarlo en el runbook para que no se obedezca.

**Estado:** decidida por la usuaria el 2026-11-25. P1 rechazada: en la nube no se puede desconectar el conector. P2 (`QA-529`) aplazada hasta volver al roadmap. P3 aplicada: la fila de `claude/ronda-local-2` está cerrada en la bitácora. G1 y G2 aprobadas para el flujo, las recoge `gw-harvest`.
