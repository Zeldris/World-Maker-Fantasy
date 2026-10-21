# Retro del PR de `claude/banco-narrador` (2026-10-21)

Lo revisado: lo que entra con el PR a `main` (`git log origin/main..HEAD`). Es el banco del narrador de `QA-176`:

- el informe del 2026-10-21;
- P-005 a P-007 rechazadas por la usuaria;
- el sello de «Modelos de IA»;
- la tanda con `IA_CASOS` (subagente en `sonnet`), el juicio a ciegas (dos subagentes en Opus) y `bench-ia.sh`;
- el `/code-review --max-findings all` previo: 11 hallazgos, arreglados en `24c2d9be`.

También se revisan las skills `scout-updates` (`banco-calidad.md`, `banco.py`), `opt-tokens` y `/code-review`.

**Estado (2026-10-21): pendiente de la usuaria.**

## Medida (`/opt-tokens`)

**Sesión principal.** 108 llamadas en Opus, con un contexto medio de 107k y una compactación (suelo 58k, techo 150k).
La curva está sana para lo largo que fue: tanda, generación, juicio, bench e informe en una sola sesión.

**Subagentes.** Son 90 llamadas y 5,77M de entrada:

- La tanda de juego en `sonnet` es lo más caro: 69 llamadas y 4,66M. Parte de ese gasto vino de las herramientas del
  driver que fallaban (ver 5).
- Los dos jueces en Opus: 15 llamadas y 0,8M.

**Lo que más pesó en la principal:**

- Leer `rondas-de-pruebas.md` en la principal antes de delegar la tanda: 267k arrastrados. El subagente lo lee de todos
  modos.
- Tres scripts improvisados sobre `~/banco/` para sacar puntos por caso, cara a cara y motivos: unos 13k, con unos 350k
  arrastrados.

## 1. Las cifras del informe salieron de scripts propios y no cuadraban con `banco.py`

**Qué pasó.** `banco.py resumen` da solo la tasa por modelo. El cara a cara y los puntos por caso los saqué con
scripts improvisados que contaban veredicto a veredicto. `banco.py`, en cambio, cuenta como empate el par cuyo
ganador cambia al girarlo. El resultado: el `/code-review` encontró que el cara a cara y la tabla por caso no sumaban
48/66, y que dos celdas estaban cruzadas. Los fallos típicos de cada modelo también los escribí primero de memoria,
y uno estaba atribuido al modelo equivocado (la fuga de metadatos es de gemma3, no de qwen).

**Propuesta.** `banco.py resumen --detalle` saca tres cosas más con el mismo método de conteo:

- el cara a cara;
- los puntos por caso;
- los motivos de los pares que pierde cada modelo (con la clave ya abierta).

El paso del informe en `banco-calidad.md` dice entonces que todas las cifras y los fallos típicos salen de
`--detalle`. Va con su test en `test_scripts.py`.

**Riesgo:** ninguno; es la misma cuenta, puesta a la vista.

## 2. `banco-calidad.md` no dice cuándo se adopta o se reabre un candidato

**Qué pasó.** El método solo dice que una diferencia menor de ~0,15 es ruido. Escribí en el informe un criterio que la
skill no tiene («gana por más de ~0,15»). En `propuestas.md` puse otro umbral inventado (0,45), que dejaría reabrir
un candidato que sigue perdiendo. Los dos los cazó el `/code-review`.

**Propuesta.** Una regla de decisión en `banco-calidad.md`:

- **Adoptar**, si el candidato gana al actual por más de ~0,15.
- **Dentro del ruido**: deciden la memoria y la latencia.
- **Rechazar**, si pierde por más de ~0,15. La condición para reabrir es «quedar dentro del ruido» tras el cambio que
  la motive.

**Riesgo:** ninguno; pone por escrito lo que ya se aplicó.

## 3. `medir.py` de `opt-tokens` cuenta como lectura un script que solo se ejecuta

**Qué pasó.** `POR ARCHIVO` da `tools/qa/host.sh` leído 23 veces, con 197k arrastrados. Casi todas son órdenes
`bash tools/qa/host.sh <orden>`: el script se ejecuta, no se lee. La cifra infla el archivo y tapa las lecturas de
verdad.

**Propuesta.** En `medir.py`, una ruta que va justo detrás de `bash`, `sh`, `python3` o `./` cuenta como ejecución,
no como lectura. Va con su caso en `test_medir.py`.

**Riesgo:** ninguno.

## 4. Desde el sandbox, `git push` y `host.sh` traen ruido o fallan sin avisar

**Qué pasó.** Hubo dos problemas:

- El primer `git push` desde el sandbox falló en silencio: el gancho pre-push necesita `npx`, que solo está en el host.
- `host.sh` filtra solo los avisos de `bash -i` en inglés. En la Deck salen en español («no se puede establecer el
  grupo de proceso de terminal», «no hay control de trabajos») y van acompañados del ruido de `nvm`/`npmrc` del
  `~/.bashrc`. Cada orden de la sesión arrastró una cadena de `grep -v`.

**Propuesta.** Dos cambios:

- El pre-push se relanza solo por `host.sh` cuando corre en el sandbox, como ya hace `bench-ia.sh`.
- `host.sh` filtra también las dos líneas en español y las de `nvm`/`npmrc`.

**Riesgo:** bajo. Un filtro demasiado ancho podría tapar un error real de `npm`. Por eso se filtran las líneas
exactas, con su test en el de `host.sh`.

## 5. Las herramientas del driver obligaron a rodeos en la tanda

**Qué pasó.** El subagente de la tanda (69 llamadas) apuntó estos fallos:

- La caja de texto está bloqueada con el mapa de zona abierto, y desactivada en una escena.
- `turno.js` a veces no envía en combate.
- `estado.js` no lee el panel «Tu personaje» del combate y corta el final de la narración.
- `viajar.js` vuelve sin confirmar.

Cada uno costó varias llamadas de rodeo (`opcion.js`, `combate.js`, otra lectura del estado).

**Propuesta.** Una tarea `QA-` para arreglar `estado.js` (panel de combate y narración entera), `viajar.js` (esperar la
llegada) y `turno.js` en combate. También, que `turno.js` avise si la caja está desactivada y diga qué usar.

**Riesgo:** ninguno para el juego; son herramientas de prueba con sus tests.

## 6. Una rama que cumple el «Siguiente» de otra no tiene quién se lo diga

**Qué pasó.** La fila de `claude/frontend-improvements-roadmap-0mpckt` seguía con «Siguiente: banco del narrador», y
la entrada de `QA-176` en `roadmap-front.md` seguía con «Falta: banco del narrador». Los dos los cazó el `/code-review`,
no la sesión.

**Propuesta.** Un aviso en `bitacora.py`, que corre en el pre-push, cuando los commits de la rama nombran una tarea `🚧`
y su línea del roadmap no cambia en el diff contra `main`. Es solo un aviso: no bloquea.

**Riesgo:** falsos avisos en commits que solo citan la tarea de paso; por eso no bloquea.

## Skills

- **`/code-review`** rindió bien: 11 hallazgos, todos reales. Encontró lo que la sesión no comprobó, incluidas las
  cuentas.
- **`opt-tokens`**: la medida sirvió, salvo el conteo de `host.sh` (ver 3).
- **`banco-calidad.md`**: le faltaban el detalle (ver 1) y la regla de decisión (ver 2).
