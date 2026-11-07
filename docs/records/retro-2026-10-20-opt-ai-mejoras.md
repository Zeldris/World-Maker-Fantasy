# Retro del PR de `claude/opt-ai-mejoras` (2026-10-20)

Lo revisado: lo que entra con el PR a `main` (`git log origin/main..HEAD`): las 9 propuestas de `/opt-ai` aplicadas
en la Deck (`QA-160`…`QA-168`, un bench antes y después de cada una, [registro](../ia/opt-ai-registro.md)), la
fusión de `main` (PR #69), los 13 hallazgos del `/code-review --max-findings all` (9 arreglados, 2 descartados tras
comprobarlos, 2 de comentario), el bench 09 tras los arreglos, `/opt-tokens` y las skills `opt-ai`, `opt-tokens` y
`/code-review`.

**Estado (2026-10-20): aprobadas todas por la usuaria, aplicadas en esta rama** (`QA-169`…`QA-175`). En la 1, la
usuaria propuso en su lugar mover el `/code-review` del PR tras `/opt-tokens` y `/opt-ai`; se quedó la propuesta,
porque los cuatro fallos venían de las tareas de `opt-ai`, que ya iban antes de esa revisión.

## Medida (`/opt-tokens`)

Principal: 319 llamadas, contexto medio 109k; compacta a ~200k con techo medio ~160k (la curva está bien). Sin
subagentes. Lo que más gastó: 52 llamadas de bench y `medir.py` más 13 esperas, 44 llamadas de documentos de cierre
(roadmap, mapa de roadmaps, bitácora) y 39 lecturas de `narrador.ts` (2.883 líneas; la lectura más grande arrastró
443k). La IA del juego quedó en objetivo: turno p50 61 → 29-32 s, p95 → 53-56 s, primera palabra 45 → 17-19 s.

## 1. El `/code-review` final encontró cuatro fallos de verdad que el bench no veía

**Qué pasó.** Cada propuesta de `/opt-ai` se cerró con su bench y tests en verde, sin revisión del diff. El
`/code-review` del PR encontró: el `AsyncLocalStorage` del turno (`QA-162`) se pegaba al socket y filtraba el turno
a la petición siguiente; `num_ctx` se leía de `/api/ps` del runner cargado y no del Modelfile; el respaldo de
`narrar` y `clasificar` usaban `num_ctx` distintos y Ollama recargaba el modelo entre uno y otro (`QA-168`); y los
NPC muertos seguían contando como agresores. Ninguno movía las cifras del bench lo bastante para notarse.
**Propuesta.** En `.claude/skills/opt-ai/SKILL.md`, en la parte de aplicar lo aprobado: antes del commit de cada
propuesta, `/code-review` corto (`low`) de su diff, como ya se hace con los diffs de subagentes (`QA-126`).
**Riesgo:** algo más de coste por propuesta; es una revisión corta de un diff pequeño y ahorra la segunda vuelta.

## 2. `keep_alive` y `num_ctx` se cambiaron mirando una sola llamada

**Qué pasó.** `QA-168` cambió `clasificar` y el bench salió bien, pero el respaldo de `narrar` usa el mismo modelo
con otro `num_ctx` y cada respaldo lo recargaba. En Ollama los dos parámetros son por modelo cargado, no por llamada.
**Propuesta.** En `.claude/skills/opt-ai/motores.md` (sección Ollama) y en el paso 3 de la skill: al tocar
`keep_alive` o `num_ctx` de un modelo, buscar todas las llamadas a ese modelo (`env.ollamaModel…`) y alinearlas, con
una constante compartida como `CTX_CRONISTA`. **Riesgo:** ninguno.

## 3. Cerrar una tarea cuesta muchas llamadas de documentos (`/opt-tokens`)

**Qué pasó.** 44 llamadas en tachar la tarea en su roadmap y en `21-roadmap.md`, y moverla a «Hecho recientemente»
recortando a 10. **Propuesta.** `tools/roadmap/cerrar.py QA-n "nota"`: tacha en el roadmap de la tarea y en el mapa,
añade `✅ fecha` + nota y la mete en «Hecho recientemente» (dejando 10). **Riesgo:** que tache mal una fila con
formato raro; contrapeso: imprime el diff y `cobertura.py` sigue validando.

## 4. `narrador.ts` se leyó 39 veces (`/opt-tokens`)

**Qué pasó.** Para cada propuesta hubo que reencontrar el orden de bloques de `buildNarrationPrompt`, los intentos
1/2/3 y qué `keepAlive`/`numCtx` usa cada tarea. **Propuesta.** Subsección «Prompt del narrador» en
`docs/mapa-agente.md`: funciones de entrada, orden de bloques, intentos y la tabla modelo → `num_ctx`/`keep_alive`
por tarea. **Riesgo:** que se quede vieja; contrapeso: la `/retro` y `opt-ai` la comprueban al tocar el narrador.

## 5. El bench de IA se montaba a mano cada vez (`/opt-tokens`)

**Qué pasó.** 52 llamadas de bench/`medir.py` y 13 esperas: restaurar el dump, reindexar, lanzar 8 turnos, muestrear
RAM y `ollama ps` en otro bucle y comparar. `logs/bench.sh` es local y no está en git: la otra cuenta no lo tiene.
**Propuesta.** `tools/qa/bench-ia.sh <etiqueta> [--anterior <etiqueta>]` versionado: hace todo eso en una orden y
devuelve solo el resumen y la salida de `medir.py`; apuntarlo en `.claude/skills/opt-ai/proyecto.md`.
**Riesgo:** ninguno; mismo bench, misma semilla.

## 6. `reindex-lore.ts` se reformateó entero a comillas dobles

**Qué pasó.** Al reescribir el script salió con comillas dobles; el backend no tiene configuración de formato y el
diff creció con ruido que hubo que deshacer. Es un fallo **mecánico**. **Propuesta.** `.prettierrc` en `backend/`
con `singleQuote: true` (y lo demás según el código actual), sin reformatear lo existente en este PR.
**Riesgo:** ninguno si no se aplica a todo el árbol de golpe.

## 7. `opt-tokens/medir.py` no agrupa las lecturas por archivo

**Qué pasó.** Las 39 lecturas de `narrador.ts` hubo que contarlas a mano: `medir.py` agrupa por herramienta, y las
lecturas por `Bash` (`sed -n`, `grep`) no salen por archivo. **Propuesta.** Sección `POR ARCHIVO` en
`.claude/skills/opt-tokens/medir.py`: lecturas (Read y Bash con ruta) y tokens arrastrados por ruta, las 10 primeras.
**Riesgo:** ninguno.
