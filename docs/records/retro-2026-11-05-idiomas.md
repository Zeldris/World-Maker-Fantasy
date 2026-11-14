# Retro: roadmap de idiomas y hitos renumerados (`IDI-1`…`IDI-15`)

Rama `claude/wonderful-volta-662qt8`, 2026-11-05. Tarea de documentación: roadmap nuevo de idiomas (internacionalización
y lenguas del mundo), la Beta de Berig pasa del `0.8` al `0.7` y Personaje propio del `0.7` al `1.1`, tras Vaelira.

**Estado:** aplazada la propuesta 1 (usuaria, 2026-11-05; apuntada en la bitácora), la 2 sin cambio; gw-opt-tokens sin propuestas.

## Qué fue bien

- Las dos preguntas de alcance (qué número toma cada hito, si la base de i18n va ya) se hicieron antes de escribir, y
  la renumeración se hizo con un script que comprueba que cada sustitución casa una sola vez.
- `cobertura.py` cazó al momento que la serie nueva tenía que estar registrada; con ella dio «SIN HITO: 0».
- La pregunta de la usuaria sobre las lenguas del mundo se contestó leyendo primero lo que ya había
  (`loreLanguages.ts`, `lenguas-helek.md`) en vez de proponer algo nuevo desde cero.

## Candidatas a mejora

1. **`cobertura.py` no mira el roadmap de mapas** (proyecto, comprobación): `MAP` no está en `PREF` ni
   `roadmap-mapas.md` en `files`, así que `MAP-1`…`MAP-15` no tienen hito y el check no lo dice. Propuesta: añadirlos
   y dar hito a las tareas `MAP` (el mismo cambio que se hizo hoy para `IDI`). Medio: la regla «ninguna tarea sin
   hito» se rompe sin aviso.
2. **Una orden de lectura se colgó 120 s** (tool economy): un `sed | rev | cut` sobre líneas largas pasó a segundo
   plano sin salida; se rehízo con Python. Puntual, sin cambio.

## gw-opt-tokens

Sesión corta para esta tarea (sin compactaciones desde que empezó); el gasto fue leer `21-roadmap.md` por trozos.
Sin propuestas.
