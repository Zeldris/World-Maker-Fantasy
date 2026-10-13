# Instrucciones para Claude en este repositorio

Este proyecto se trabaja desde **dos cuentas de Claude** que se van relevando. Una sesión puede
quedarse sin tokens en cualquier momento y otra (de la otra cuenta) tiene que poder seguir **sin
perder nada y sin preguntar por dónde iba**. Todo lo de este archivo existe para eso.

## Al empezar cualquier sesión

1. Lee [`docs/registros/traspaso.md`](docs/registros/traspaso.md): rama de trabajo, tarea en curso,
   qué falta y siguiente paso.
2. Mira `git log` de esa rama (`git fetch origin <rama>` primero) y comprueba que el último commit
   coincide con lo que dice la bitácora.
3. Comprueba que los tests están como dice la bitácora antes de tocar nada.
4. Sigue por el **siguiente paso** de la bitácora, salvo que el usuario pida otra cosa.
5. Al empezar cada tarea, aplica el selector (qué skill y qué modelo pide el caso) y sigue el flujo
   de skills de una tarea (diseño, prototipo, bugs, PR, retro) de
   [`docs/runbooks/skills-y-modelos.md`](docs/runbooks/skills-y-modelos.md#cómo-se-usa-el-flujo-de-una-tarea).

**Diseño (usuaria, 2026-10-07):** toda ronda de diseño, también las de detalle, se contrasta con
X4: Foundations, D&D 5e, Baldur's Gate 3, Medieval Dynasty, Bellwright y Manor Lords, citando de cuál
sale cada propuesta; **X4 marca el camino** siempre que se pueda
([runbook](docs/runbooks/skills-y-modelos.md#cómo-se-usa-el-flujo-de-una-tarea)).

Otras reglas que siguen vigentes: [`AGENTS.md`](AGENTS.md) (lore: nunca editar `docs/rpgtarkor/`
directamente) y la forma de trabajo de cada plan de hito (p. ej.
[`docs/producto/plan-roadmap-0.1.md`](docs/producto/plan-roadmap-0.1.md)). Orden y fases de todo
el trabajo: [mapa de roadmaps](docs/producto/21-roadmap.md#mapa-de-roadmaps).

## Trabajo por relevos: commit y push constantes

Cada sesión corre en un contenedor temporal: **lo que no está subido a GitHub no existe** para la
siguiente sesión.

- **Al cerrar cada tarea** del roadmap (identificadores `UX-3`, `CR-12`, `ZON-10`…): commit +
  push en el acto, la tarea tachada en su roadmap y en el mapa de `21-roadmap.md`, y la bitácora
  actualizada.
- **El estado vive en los `.md`, no en la conversación** (petición de la usuaria, 2026-10-02): en el
  roadmap de cada tarea, junto al tachado, `✅ fecha` + qué se hizo y **qué queda pendiente** si la
  tarea se cerró solo en parte (p. ej. "parte del 0.1 hecha; falta X para el menú de
  Configuración"). Una tarea a medias se marca `🚧 en curso` con lo hecho y lo que falta. Así la otra
  cuenta sabe exactamente qué está implementado sin leer el código ni el historial.
- **Ninguna tarea sin hito** (petición de la usuaria, 2026-10-02): toda tarea nueva que se añada a
  cualquier roadmap entra en una fase de su roadmap o en una fila de «Qué entra en cada hito»
  (`21-roadmap.md`). Antes de cerrar un hito y tras añadir tareas, `python3 tools/roadmap/cobertura.py`
  tiene que dar «SIN HITO: 0».
- **Dentro de una tarea grande**, commit + push en cada punto estable (tests en verde). Las tareas
  grandes se parten en pasos pequeños con su propio commit.
- **Nunca más de 30-45 minutos de trabajo sin subir.**
- **Si hay que parar con algo a medias o con tests en rojo:** commit igualmente en la rama de
  trabajo, con `WIP:` al principio del mensaje, y en la bitácora qué falla y por qué. Nunca dejar
  trabajo solo en local.
- **Push siempre tras cada commit**, a la rama de trabajo (`git push -u origin <rama>`; si falla
  por red, reintentar con espera 2 s, 4 s, 8 s, 16 s).
- **La bitácora se actualiza en el mismo commit** que el trabajo que describe, no al final de la
  sesión.
- **Tras una llamada interrumpida o rechazada, `git status` y `git diff` antes de repetirla** (`QA-48`):
  el cambio puede haberse guardado, o incluso subido, y repetirlo lo duplica.

## Pruebas de juego

**Hasta cerrar las pruebas, no hay roadmap** (usuaria, 2026-10-13). Ninguna tarea nueva del roadmap,
ni se añaden más, hasta que se haya probado jugando todo lo implementado (del `0.1` al hito en curso),
lleve lo que lleve. Las dos cuentas juegan rondas de pruebas, arreglan lo que sale y cierran lo que está
a medias (p. ej. `QA-63`). Sí entran las tareas de las retros que apruebe la usuaria (mejoran el entorno
de trabajo, no el juego).

**Al volver al roadmap, cada tarea se prueba al momento**: se implementa, se pasan los tests y se juega
lo que cambia antes de darla por cerrada, sin dejar arreglos para una fase posterior. Sustituye a la
decisión del 2026-10-02: implementación continua solo con tests y pruebas de juego en una fase única
antes de la beta.

**Al jugar** (ronda de pruebas, «sigue probando», «juega»): antes de la primera acción, relee
[`docs/runbooks/rondas-de-pruebas.md`](docs/runbooks/rondas-de-pruebas.md): con qué se juega, qué se
prueba y cómo se apunta (`QA-56`).

## Mensajes de commit

- Primera línea en español, qué cambia, con los identificadores de las tareas tocadas.
- Cuerpo: qué se hizo, qué queda de esa tarea si no está cerrada, y estado de los tests.
- Última línea antes de la atribución: `Siguiente: <próximo paso concreto>`.

## Ramas y `main`

- Se trabaja siempre en la rama que indique la bitácora (o la que asigne la sesión, que se apunta
  en la bitácora nada más empezar).
- **A `main` solo se sube cuando el usuario lo confirma.** Al hacerlo, se apunta en la bitácora.
- **Se fusiona solo con el CI del PR en verde** (usuaria, 2026-10-12), también cuando pide «fusiona
  directamente»: eso quita esperar a más revisiones, no al CI. El gancho de `QA-50` lo comprueba (`QA-62`).
- **Antes de un PR a `main`, `/code-review --max-findings all`** del diff contra `main`, los arreglos
  subidos, `bash tools/qa/revisado.sh` y la descripción con la skill `pr`
  ([paso 6](docs/runbooks/skills-y-modelos.md#cómo-se-usa-el-flujo-de-una-tarea)). Sin la marca de
  revisión del mismo commit, un gancho bloquea crear o fusionar el PR (`QA-50`).
- **Tras fusionar cada PR a `main`, `/retro`** (usuaria, 2026-10-13) sobre lo que entró con él. Sus
  propuestas se presentan a la usuaria y solo lo que confirme entra como tarea.

## La bitácora (`docs/registros/traspaso.md`)

Tiene siempre al día: rama de trabajo, hito y fase, tarea en curso con lo hecho y lo pendiente,
último commit y estado de los tests, siguientes pasos en orden, decisiones de Álvaro que bloquean
algo, y los comandos para comprobar el estado. Al cerrar una tarea, se mueve a "Hecho
recientemente" (las 10 últimas; lo más antiguo se borra, el historial ya está en git). Cada rama tiene
su fila «Tarea en curso · `<rama>`» y solo escribe en la suya: la tarea actual, lo que falta y el
siguiente paso, como mucho 600 caracteres (lo comprueba el push, `QA-69`).
