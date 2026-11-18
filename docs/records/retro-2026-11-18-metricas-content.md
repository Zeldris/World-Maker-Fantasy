# Retro 2026-11-18: métricas como contenido (QA-511)

**Estado:** aprobada y aplicada por la usuaria («Hazlos», 2026-11-18): P1 aplicada en `.claude/gw.json`.

## Qué pasó

Fusionar el PR #101 costó varias vueltas: cada turno reescribe `docs/metrics/ledger.jsonl`, el gancho de cierre
pide subirlo, y ese commit contaba como código para `review-before-main.sh`. Invalidaba la marca de revisión y
relanzaba el CI antes de cada intento de fusión.

## Propuestas

- **P1 (proyecto, aplicada):** `docs/metrics/` en `content` de `.claude/gw.json`. Riesgo de calidad: ninguno; son
  registros de métricas, no código ni configuración.

## For Galivelop-workflow

- El ledger de métricas del propio flujo debería contar como contenido por defecto en la plantilla de `gw.json`:
  le pasa a cualquier proyecto con `requireRetro` y el gancho de cierre.
