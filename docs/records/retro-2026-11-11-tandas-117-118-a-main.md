# Retro: tandas 117-118 y P454, antes de `main`

Rama `claude/wonderful-volta-662qt8`, 2026-11-11. Tandas 117 y 118 (P454, P377, P383, P371, P374, P432, P434),
arreglo de P454 (`lineaDeCierreDelCombate`), fase 1 contra `origin/main` (un comentario recolocado, `c3345e4e`) y
`/gw-opt-tokens` (`QA-322`, `QA-323`).

**Estado:** sin decidir; la usuaria decide las candidatas.

## Qué fue bien

- La fase 1 no dio fallos: el arreglo de P454 llegó con su test en rojo sin el arreglo.
- Los ganchos pararon tres errores antes del CI, cada uno con su orden para reproducirlo: la matriz de pruebas
  (`matriz-pruebas.py --comprobar`), el resumen de hallazgos desfasado (`marca-hallazgo.py --resumen --comprobar`) y
  `QA-322`/`QA-323` sin apuntar en «Hecho» (`handoff.py closed`).
- `gw-selector`, `gw-opt-tokens` y la revisión hicieron su papel sin tropiezos: ninguna propuesta para ellas.

## Candidatas, por gravedad

1. **El aviso de P442 sale en cada comprobación** (comprobaciones, proyecto). `marca-hallazgo.py --resumen
   --comprobar` imprime en cada push «aviso: el estado de P442 se contradice (✅ y cerrado o pendiente de la
   usuaria)». Un aviso fijo enseña a no leer avisos y tapa el próximo de verdad. Cambio: reescribir el estado de P442
   con `marca-hallazgo.py` para que diga solo «no aplica (fallo del escenario)» con su fecha, sin el ✅ que lo
   contradice; el aviso desaparece.
2. **La entrada del combate en el mapa no nombra el final del combate** (navegación, proyecto). Para P454 la sesión
   leyó `combateMultipleOrquestacion.ts` diez veces buscando dónde acaba un combate. Cambio: en
   `docs/mapa-agente.md` «Combate», añadir `avanzarYComprobarFin` (fin del combate, tótems) y
   `escribirCierreDelCombate` (línea de cierre en el diario, P454) a la lista de código.

## Para Galivelop-workflow

3. **`handoff.py closed` dice qué falta, pero no la orden que lo arregla** (comprobaciones, general). El mensaje
   «`<ID>` is closed in the plan; list it in the "Done" section» manda a editar la bitácora a mano, y la herramienta
   ya existe. Cambio en `.claude/gw/scripts/handoff.py`, en el `print` de `closed`: añadir
   `fix: python3 .claude/gw/scripts/handoff.py done '<ID>: <qué se hizo>'`. Va al repositorio del flujo; aquí no se
   toca la copia.
