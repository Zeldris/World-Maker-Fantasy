# Retro — `/gw-update` v0.2.0 → v0.4.3 y difusión al formato nuevo (2026-11-02)

Rama `claude/frontend-improvements-roadmap-0mpckt`, commits `f2e83984`..`f287d043`. Medido con `opt-tokens/medir.py`
(sesión entera): 158 llamadas, 114k de contexto medio, 4 compactaciones (techo ~143k), un subagente Opus de 17
llamadas (el `/code-review`).

**Estado:** aprobadas las tres (usuaria, 2026-11-02). R1 y R3 aplicadas en la rama; R2 propuesta a Galivelop-workflow.

## Propuestas

### R1. La difusión vuelve al check (comprobación automática, de WMF)

`comprobar.py` sin argumentos sale con 2 desde v0.4.3 y salió del `check` (`.claude/gw.json`): nadie valida
`docs/media`. Cambio: `tools/qa/difusion.sh`, que corre `comprobar.py --prefijos-tarea … --formato-propio web`
sobre cada pieza y no cuenta las normas de Reddit sin leer (dependen de la usuaria), con su test; una línea en
`check`. Coste: un script y un test. Riesgo: ninguno; tocar `gw.json` pide su visto bueno.

### R2. Leer menos al actualizar el flujo (economía, para Galivelop-workflow)

Las relecturas pesaron más que nada: `comprobar.py` 15 veces (219k arrastrados), `AGENTS.md` 26 (153k),
`recuperar.py` 12 (108k), `CHANGELOG.md` y `aplicar.py` del flujo. Casi todo fue reconciliar los desvíos locales con
la versión nueva y aprender el formato de piezas a base de leer el script. Cambio: que `aplicar.py --update` liste
cada desvío local con su diff resumido, y que `comprobar.py --help` describa el formato (hoy da «unknown option»).
Riesgo: ninguno.

### R3. Una sesión de actualización del flujo, un subagente para la reconciliación (economía, de WMF)

En `.claude/gw/opt-tokens.md`: con `/gw-update` sobre una copia con desvíos, la comparación archivo a archivo la hace
un subagente (Sonnet) que devuelve la tabla «desvío · arriba · decisión propuesta», y la sesión principal solo
decide. Ahorro estimado: ~0,5-1 M de entrada por actualización. Riesgo: que el subagente dé por igual un desvío a
propósito; contrapeso: `doctor.py` y los tests de `tools/qa` tras aplicar.

## Ya hecho en la rama

- La fase 3 documentada sin `--footer` (el `commit-msg` habría rechazado la marca): arreglado en `f287d043`.
- Los hallazgos de la revisión en scripts del flujo, como P6-P15 en `docs/records/propuestas-flujo.md`.

## For Galivelop-workflow

- R2 (arriba), y P1-P15 de `docs/records/propuestas-flujo.md`.
