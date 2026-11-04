# Retro 2026-11-04 · cierre del paso 3.3 (`claude/wonderful-volta-662qt8`)

**Sesión:** nube, 2026-11-04, desde la fusión del PR 84 (`5b1f6a2e`). Tandas 86-88 de la ronda de la puerta y cierre
del paso 3.3 (usuaria). El diff contra `main` es solo contenido (`docs/records/`): no hay fase 1 de código.

**Estado:** las tres (1, 2 y 3) aprobadas y aplazadas por la usuaria (2026-11-04), para no mezclarlas con el
cierre del 3.3; van a «Propuestas aprobadas…» de la bitácora, sin número hasta que entren.

## Candidatas, de más a menos grave

1. **Un asalto con Gorhorn fuera no se prepara sin SQL** (herramienta, del proyecto). En la tanda 88, para probar
   P253, el subagente movió a Gorhorn con un `UPDATE` (`currentLocationId`, `zonaPos`) y quitó la guarnición a mano:
   la regla de la tanda («solo funciones del juego») se rompió y el resultado no vale como comprobado (P253 sigue en
   parte). Propuesta: `escenario.sh preparar <partida> fuera:<lugar>` (con la función del viaje) y
   `sin-guarnicion`, con test en `test_escenario.py`; cierra P427.
2. **Un subagente que no llega con los pasos usa SQL en vez de devolver «sin ver»** (encargo, del proyecto). Lo dijo
   bien en su informe, pero gastó la tanda en un resultado que no cuenta. Propuesta: en
   `rondas-de-pruebas.md`, una línea: lo preparado a mano se devuelve como «sin ver · falta paso de preparación
   <cuál>», sin seguir jugando sobre ello. Riesgo: ninguno.

## Gasto (`gw-opt-tokens`)

`measure.py --since 5b1f6a2e`: principal, 70 llamadas, 95k de contexto medio (techo 121k, sin compactar), 6,7M de
entrada; el subagente de la tanda 88, 56 llamadas, 95k medio, 58k de arranque, 5,3M.

3. **Releer las filas del plan y del registro** (herramienta, del proyecto). `plan-comprobacion-puerta.md` se leyó
   15 veces (250k arrastrados), `traspaso.md` 17 (334k) y `pruebas-0.3-hallazgos.md` 14 (123k): con `sed`/`grep`
   sobre filas de 300-1.500 caracteres, para saber qué pedía una tanda o en qué estado está un P. Propuesta: `python3 tools/qa/marca-hallazgo.py --ver P<n>[,P<m>]` (estado recortado del registro y las tandas
   del plan que lo nombran, también recortadas), con test; puntero en `gw-opt-tokens.md`. Ahorro estimado: ~300k de
   entrada por sesión de reparto. Riesgo: que el recorte esconda un detalle; `--entero` da la fila completa.
4. **Arranque de 58k por subagente de tanda** (conocido, `QA-124`): no se propone nada nuevo.
