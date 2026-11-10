# Retro 2026-11-10: `claude/pedido-mapa` (MAP-14, MAP-18) hacia `main`

Sesión tras el `/clear`: fase 1 de las tres hacia `main` (13 hallazgos, 6 arreglados con 4 tests que fallan sin su
arreglo), `gw-opt-tokens` y esta retro.

## Gasto (`gw-opt-tokens`)

30 llamadas con 81k de contexto medio (suelo 49k, techo 101k), sin compactación; el subagente de `/code-review` (Opus,
15 llamadas) metió 1,28 M de 3,71 M. No hay propuesta de gasto con peso: lo único evitable fueron 3 llamadas para dar
con una edición válida en un test (P2).

## Propuestas

**P1 · Comprobaciones (proyecto).** La revisión encontró que `map-generator/AGENTES.md` dice «un agente nunca pone
`canon: true`» y `agente_local.ejecutar` no lo filtraba: una regla de la guía que solo vivía en texto. Ya está
arreglado con su test. Propuesta: una línea en `REVIEW.md`: «cada prohibición de `map-generator/AGENTES.md` que se
pueda leer del lote o de la orden tiene su filtro en `agente_local.ejecutar` y su test en `test_banco.py`». Coste: una
línea. Riesgo: ninguno.

**P2 · Navegación (proyecto).** Para el test de lotes en orden probé tres ediciones hasta dar con una que pasara el
canon y el lore (fuera de Berig toda celda es región 0; dos alturas a la misma celda no dependen una de otra). Propuesta:
un párrafo en `map-generator/tests/` (docstring de `test_banco.py` o un `_ejemplos.py`) con las ediciones que siempre
pasan: subir 1 una celda de tierra fuera de Berig, y en Berig solo con `"bloqueo": []`. Coste: bajo. Riesgo: ninguno.

**P3 · Comprobaciones (proyecto).** `python3 -m unittest tests.test_zonas` desde `map-generator/` falla al importar
`_sinzonas` (solo funciona desde `tests/`). Propuesta: `sys.path.insert(0, AQUI)` en `test_zonas.py`, como hace
`test_banco.py` con sus rutas. Coste: una línea. Riesgo: ninguno.

**P4 · Información (proyecto).** Los arreglos del visor (repintado al pintar zona, no guardar con una zona vacía) no
tienen test: los de `test_visor.py` son estáticos. Propuesta: probarlos a mano en el visor antes de fusionar, o
aplazarlo y apuntarlo como pendiente de MAP-14. Un test del visor en navegador costaría más que lo que protege ahora.

**Estado:** aprobada y aplicada entera (Álvaro, 2026-11-10): P1 en `REVIEW.md` («Agentes del mapa»), P2 en el
docstring de `test_banco.py`, P3 en `test_zonas.py` y P4 probado con Playwright sin pantalla sobre una copia del mapa
(la caché de las otras zonas queda intacta al pintar; con una zona vacía no se envía nada y avisa; tras borrarla,
guarda).
