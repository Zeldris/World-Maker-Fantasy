<!-- galivelop-workflow v0.2.0 -->
# scout-updates — notas del proyecto

Las lee primero la skill `scout-updates`: qué vigilar y qué no. El flujo las crea una vez; desde entonces son del
proyecto.

## Dónde está la memoria

En este repositorio la memoria **no** va en `.claude/gw/scout/`, sino en `docs/scout/` (piloto del flujo,
2026-10-22): la enlazan los informes, el roadmap y las retros.

- `architecture.md` → [`docs/scout/arquitectura.md`](../../docs/scout/arquitectura.md).
- `proposals.md` → [`docs/scout/propuestas.md`](../../docs/scout/propuestas.md). Estados en español:
  `propuesta`, `aceptada`, `aplicada`, `rechazada: <motivo>`.
- Informes: `docs/scout/informes/<fecha>.md`.

`scripts/compare.py` busca tres textos en inglés: el título `## Constraints` (no se compara), la cabecera de columna
`Component` y, en el informe, el título `## Coverage`. Se escriben así aunque el resto vaya en español; con
`Restricciones`, `Componente` o `Cobertura` el script falla o cuenta de más.

## Vale la pena seguir

- **Modelos de IA del narrador y del Cronista** (Ollama en la Steam Deck): el turno y la calidad del juego dependen de
  ellos. Tope de memoria: el del narrador actual (sección `Constraints`).
- **Generador de lore de OpenCode** (`opencode.json`, `modelfiles/`).

## Banco de calidad (paso 5)

Los modelos generativos se miden con el banco por pares a ciegas del proyecto: guía en
[`docs/scout/banco/README.md`](../../docs/scout/banco/README.md), script `tools/qa/banco-calidad.py` (test en
`tools/qa/tests/test_banco_calidad.py`). Cada componente con banco lleva en `arquitectura.md` la línea
`banco · <componente>: casos <ruta>, rúbrica <ruta>`. La usuaria elige los candidatos entre los supervivientes del
paso 4; juez, el propio agente, salvo que ella pida otro. Cierra con `banco-calidad.py resumen` (tasa, consistencia
al girar y sesgo de posición). La memoria y la latencia se miden aparte en la Deck con `bash tools/qa/bench-ia.sh`.

## Ignorados

- Lo rechazado en `propuestas.md` (P-002 a P-007), salvo que su motivo deje de valer.

## Fuentes preferidas

- Las de `references/sources.md` de la skill.

## Presupuesto

- La estimación del paso 2 de la skill (unos 90k tokens por sección); no se busca sin el sí de la usuaria.
- No releer `arquitectura.md` entera: `compare.py --section <título>` (retro del 2026-10-20, 146k arrastrados).
