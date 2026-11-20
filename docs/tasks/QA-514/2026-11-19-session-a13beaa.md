# 2026-11-19 · session · pending · QA-514

## Why

Ollama guarda una sola caché de prefijo por modelo; `dialogo_npc`, `modo_dinamico` y `resumen` usan el del narrador y el `narrar` siguiente pagaba 24-58 s de prefill (exploración p50 55,5 s, p95 112 s).

## Alternatives

`OLLAMA_NUM_PARALLEL=2` (dos ranuras): descartada por memoria (~0,6 GB más con un mínimo de 1.249 MiB libres). Recalentar solo tras `dialogo_npc`: se queda corto (modo dinámico y resumen también pisan la caché); la regla «la última petición al modelo no empieza por el prefijo» cubre todas. Recalentar sin cancelar: un diálogo puro con réplica rápida esperaría el prefill entero detrás del calentamiento.

## Changed because

—
