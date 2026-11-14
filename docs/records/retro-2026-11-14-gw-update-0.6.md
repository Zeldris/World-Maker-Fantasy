# Retro · actualización del flujo v0.5.0 → v0.6.0 (`claude/gw-update-0.6`)

Sesión del 2026-11-14: `apply.py --update`, fase 1 (`f68916df`, 8 hallazgos), `ciNodeDirs`, fase 2
(`/gw-opt-tokens`: `QA-332`…`QA-334`; `/gw-opt-ai` no hacía falta). Fuentes: los commits de la rama, la salida de
`recover.py --state` y `change-size.py`.

**Estado:** aprobada entera por la usuaria (2026-11-14) y aplicada: R2 como `QA-335` (MCP de Playwright desactivado por
defecto); R1, R3 y R4 propuestas al flujo como P21, P22 y P23 en `propuestas-flujo.md`.

## Propuestas, de más a menos grave

### R1 · `Findings:` fuera del bloque final no cuenta (general → flujo, P21)

`f68916df` lleva `Findings: 8` en un párrafo propio, antes de `Siguiente:` y de la atribución. Git solo lee como
trailers el último párrafo: `git log --format='%(trailers:key=Findings)'` sale vacío. Efectos: `recover.py --state`
avisa de «review overdue» (1643 líneas en 5 commits) con la revisión ya hecha, y `metrics.py quality` pierde los 8
hallazgos. Ni el `commit-msg` ni la revisión lo cogieron.

- **Comprobación** (al flujo): el `commit-msg` rechaza un `Findings:` o `Retries:` a principio de línea fuera del
  último párrafo, con la orden que lo arregla («júntalo con `Siguiente:` y la atribución»). Es mecánico: va a un
  gancho, no a `REVIEW.md`.
- **Aquí:** nada que reescribir (la rama está subida); el aviso falso se deja hasta el PR.

### R2 · Bucle de compactación: el arranque ya es el 60 % del corte (proyecto + ajuste de la usuaria)

57 compactaciones en la sesión, 6 en esta tarea. Del arranque (~96k), ~78k son sistema, herramientas y MCP.

- **Proyecto:** `.mcp.json` carga `playwright` en todas las sesiones y solo lo usan las rondas de pruebas. Propuesta:
  sacarlo de `.mcp.json` a un archivo que la ronda active (`--mcp-config tools/playwright-e2e/mcp.json` en
  `orden.sh`/el runbook de rondas), o dejarlo en `.mcp.json` pero desactivado por defecto en `.claude/settings.json`
  (`disabledMcpjsonServers`) y activarlo al empezar una ronda. Toca `.claude/settings.json`: lo aprueba la usuaria.
- **Usuaria:** el conector Claude Docs no se usa en WMF; desactivarlo en claude.ai (Conectores) para estas sesiones.

### R3 · Commits de solo ledger (general → flujo, P22)

`92c6e7fb` y `1be821e4` son el mismo commit («ledger de la sesión de la fase 2»), y al abrir esta sesión
`docs/metrics/ledger.jsonl` ya volvía a estar modificado. Cada sesión deja un commit de ruido y el archivo choca entre
ramas (el «ledger compartido» de los pendientes leves). Propuesta al flujo: que `metrics.record` escriba el ledger en el
commit de trabajo (lo añade el `pre-commit`) o en un archivo por rama que `metrics.py` junte al leer.

### R4 · `apply.py --update` renombra nombres antiguos en el histórico (general → flujo, P23)

La actualización cambió en `roadmap-front.md` tareas cerradas (`fusionar.sh` → `merge-branch.sh`,
`mapa-agente.py` → `agent-map.py`) por nombres que en WMF no existen; la fase 1 tuvo que devolver el archivo al de
`main`. Propuesta al flujo: el renombrado no toca `recordsDir` ni los roadmaps (texto histórico), y nunca renombra a
un archivo que no existe en el proyecto. Va junto a P20 (`legacyNamesSkip`).

## For Galivelop-workflow

- P21 (R1): `commit-msg` rechaza `Findings:`/`Retries:` fuera del bloque final de trailers.
- P22 (R3): ledger de métricas sin commits propios ni conflictos entre ramas.
- P23 (R4): `apply.py --update` no renombra en el histórico ni hacia archivos que no existen.
