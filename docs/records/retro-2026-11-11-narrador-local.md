# Retro — ronda local del narrador y `/gw-opt-ai` (`claude/pedido-mapa`, 2026-11-11)

**Estado:** sin decidir; lo decide el usuario.

Fuentes: la sesión `1f1fef7e` y sus 6 subagentes (repaso de un subagente `sonnet`), `measure.py` y el
`/code-review` de la fase 1. En la sesión no hubo correcciones del usuario ni errores de herramienta graves.
Gasto: 279 llamadas y 25,0 M de entrada.

## Propuestas, por gravedad

### R1 · Parar lo levantado al cerrar la ronda (usuario) — del proyecto

Al acabar la ronda local, Ollama siguió en marcha 1 h 47 min con el modelo cargado y bajo un `systemd-inhibit`
(«wmf-ronda») que impedía suspender la Deck. Lo paré a mano en la sesión siguiente. Se había lanzado a mano,
sin script, y el runbook no tiene un paso de cierre.

- `tools/qa/deck/ia-ronda.sh arrancar|parar|estado`:
  - `arrancar` levanta `ollama serve` bajo `systemd-inhibit`, con `OLLAMA_IGPU_ENABLE=1` (ver la memoria
    «Ollama con iGPU»), y guarda los PID en `logs/ia-ronda.pid`.
  - `parar` mata esos PID y los servidores del juego de `arrancar-juego.sh`, y dice qué queda en pie.
  - Test con procesos falsos.
- En `rondas-de-pruebas.md`, al cerrar la tanda: `tools/qa/deck/ia-ronda.sh parar`, en la misma línea que la fila
  de `pendiente-opt-ai.md`. El encargo de la tanda local termina con esa orden (`skills-wmf.md`).

### R2 · Un eval o herramienta que imita una decisión del juego llama a la función real — del proyecto

El subagente de `QA-309` copió a mano la cadena de decisión de `turn.ts`/`turnResolution.ts` en
`clasificar-eval`. El `/code-review` encontró 4 diferencias: el `verboAtaque`, `forcedCombatSlugs`, la `amenaza`
y `npcCalibration`. Arreglarlas costó un subagente de 54 turnos (4,4 M).

- `REVIEW.md`: una regla de criterio. Un script de evaluación o de QA que reproduce una decisión del juego importa
  y llama a la función del juego; una copia es un hallazgo medio.
- `skills-wmf.md`, en el encargo de código: «si imitas lógica de otro módulo, impórtala; si no se puede, dilo en
  lo que devuelves».

### R3 · El encargo de código devuelve el rojo sin el arreglo y usa `tests-vitest.sh` — del proyecto

- **Tests que no comprueban nada:** el `/code-review` cazó un test tautológico de `keep_alive`, un
  `while (a[n]===b[n])` sin tope y un test que solo busca un texto. La regla `red-without-fix.sh` está en
  `AGENTS.md`, pero el encargo no pedía su salida.
- **Tests a ciegas:** dos subagentes averiguaron solos que `npx vitest` falla sin `DATABASE_URL`.
- **Cambio:** en `skills-wmf.md`, el encargo de código pide devolver la salida de
  `red-without-fix.sh` de cada test nuevo. Los tests se corren con
  `bash tools/qa/tests-vitest.sh unidad|integracion <archivos>`.

### R4 · Preparar el estado antes de jugar: comprobación SQL en el encargo — del proyecto

En la tanda de P306, el escenario B (`t65-poste-dia40`) cargó con el encuentro ya resuelto y sin Torgash en la
reputación, y en el C no se sabía qué orco era. De la tanda solo valió el escenario A. La memoria «preparar antes
de jugar» ya lo decía, pero sin un paso que lo compruebe.

- En `rondas-de-pruebas.md` (paso 2) y en el encargo de la tanda, antes de la primera acción, se comprueba con
  `tools/qa/sql.sh` que el estado que pide el hallazgo está en la partida: el NPC, la reputación o el encuentro
  abierto. Si no está, se prepara o se devuelve «sin escenario», sin jugar.

### R5 · Modelo del subagente que escribe código con el plan cerrado — para el flujo

`QA-307` fue con Opus: 44 llamadas y 4,5 M. Es la tercera vez, tras `QA-233` y `QA-251`. La regla existe en
`skills-y-modelos.md`, pero `gw-selector` no la hizo valer al repartir.

- Va al flujo, en la sección de abajo.

### R6 · El gancho Stop empuja un `WIP:` con un subagente en marcha — para el flujo

El aviso «N cambios sin commit» llevó a subir `279cf04e` («WIP: … subagente en curso») con el trabajo del
subagente a medias. Luego hubo que rehacer el commit.

- Va al flujo, en la sección de abajo.

## Skills del flujo

- **`gw-opt-tokens`:** midió bien. Tuve que pasar `--session` a mano porque, tras el `/clear`, la sesión más
  reciente es la vacía (ver abajo).
- **`gw-selector`:** fallo de R5.
- **`/code-review`:** cazó todo lo medio. Sin cambios.
- **`gw-orchestrate-dealer`:** los encargos de código no llevaban la revisión del diff de cada subagente antes de
  fusionarlo (`QA-126`). Sin esa revisión, lo de R2 y R3 llegó hasta la fase 1.

## Para Galivelop-workflow

- **R5:** que el encargo de `gw-orchestrate-dealer` lleve una línea obligatoria «modelo: X, porque Y». Que
  `gw-selector` diga `sonnet` por defecto para escribir código desde un plan cerrado, y que Opus pida un motivo
  escrito.
- **R6:** que el gancho Stop no pida commit mientras haya subagentes en segundo plano activos, o que lo diga como
  «espera al subagente y sube después».
- **`measure.py`:** tras un `/clear`, que por defecto mida la sesión anterior de la misma rama cuando la actual
  tiene menos de N llamadas. Hoy hay que pasar `--session` a mano.
- **Cierre de una ronda de pruebas (general):** que la skill de rondas o el runbook del flujo incluya un paso de
  «parar lo levantado» (servidores, modelos, inhibidores de suspensión) con un script del proyecto.
