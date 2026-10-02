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

## Pruebas de juego

Decisión de la usuaria (2026-10-02): **implementación continua** comprobando solo con tests (tsc +
vitest + oxlint en verde antes de subir). Nada de pasadas de juego por tarea; las pruebas de juego y
sus arreglos se hacen en una **fase única antes de la beta** (fila `0.8` de
[«Qué entra en cada hito»](docs/producto/21-roadmap.md#qué-entra-en-cada-hito)).

## Mensajes de commit

- Primera línea en español, qué cambia, con los identificadores de las tareas tocadas.
- Cuerpo: qué se hizo, qué queda de esa tarea si no está cerrada, y estado de los tests.
- Última línea antes de la atribución: `Siguiente: <próximo paso concreto>`.

## Ramas y `main`

- Se trabaja siempre en la rama que indique la bitácora (o la que asigne la sesión, que se apunta
  en la bitácora nada más empezar).
- **A `main` solo se sube cuando el usuario lo confirma.** Al hacerlo, se apunta en la bitácora.

## La bitácora (`docs/registros/traspaso.md`)

Tiene siempre al día: rama de trabajo, hito y fase, tarea en curso con lo hecho y lo pendiente,
último commit y estado de los tests, siguientes pasos en orden, decisiones de Álvaro que bloquean
algo, y los comandos para comprobar el estado. Al cerrar una tarea, se mueve a "Hecho
recientemente" (las 10 últimas; lo más antiguo se borra, el historial ya está en git).
