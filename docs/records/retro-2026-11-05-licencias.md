# Retro: licencias del proyecto (`QA-297`)

Rama `claude/wonderful-volta-662qt8`, 2026-11-05. Tarea corta: `LICENSE` MIT para el código y `LICENSE-CONTENIDO`
CC BY-NC-SA 4.0 para el lore, el arte, los mapas y las voces. Va a `main` junto con los dos commits del roadmap de
mapas (`MAP-1`…`MAP-15`).

**Estado:** aplazadas las dos propuestas (usuaria, 2026-11-05); gw-opt-tokens sin propuestas.

## Qué fue bien

- Antes de escribir nada se preguntó a la usuaria el alcance de la licencia (solo código o también lore). La
  pregunta cambió el resultado: dos licencias en vez de un MIT para todo.
- El texto MIT se copió tal cual del Image Generator, con el mismo titular, sin escribirlo de memoria.

## Candidatas a mejora

1. **Una tarea nueva tiene que entrar en dos sitios** (proyecto, navegación). `cobertura.py` dio «SIN HITO» porque
   `QA-297` estaba tachada en `roadmap-front.md` pero no en la fila del hito de `21-roadmap.md`. El check lo cazó y
   costó una vuelta más. Propuesta: que `siguiente-id.py` recuerde en su salida «apúntala también en
   `21-roadmap.md`». Menor.
2. **`handoff.py` sin subcomando** (proyecto, tool economy): se llamó sin `check` y devolvió el uso. Es un error
   puntual del agente; no hace falta cambiar nada.

## For Galivelop-workflow

- **Plantilla de licencia doble** (general): en los proyectos con contenido creativo (juegos, mundos), el arranque
  del flujo podría ofrecer elegir entre MIT para todo o MIT para el código más CC BY-NC-SA 4.0 para el contenido,
  con la nota de terceros. Así no hay que decidirlo a mano en cada repo.
