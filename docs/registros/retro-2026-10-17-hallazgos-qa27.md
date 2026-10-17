# Retro antes del PR de los hallazgos de QA-27, tanda 3 (2026-10-17)

Lo revisado: lo que entra con el PR de la rama `claude/frontend-improvements-roadmap-0mpckt` desde el PR #59
(P141…P187 de las tandas 2 y 3, las decisiones de diseño de la usuaria del 2026-10-17 y los 19 arreglos del
`/code-review`). Corta por petición de la usuaria (pocos tokens): sin propuestas nuevas que aplicar.

## Lo que pasó y ya está cubierto

- **Una llamada «rechazada» que sí se aplicó.** La edición del guard de combate en `edificios.ts` se dio por
  no escrita y estaba en el commit siguiente. Ya lo cubre `QA-48` (`git status` y `git diff` tras una llamada
  interrumpida o rechazada); se aplicó tarde, no falta una regla.
- **Un dato de catálogo que choca con un sistema.** El rebaño del clan como punto FAUNA de `murgol` se habría
  repartido por la población salvaje (ancla de `reconciliarGrupos`) y su clave de copia chocaba con la fauna
  salvaje. Lo cogió el `/code-review`; lo cubre la regla «Una regla nueva, en todos sus caminos» de `REVIEW.md`.
- **Mover una plantilla duplica en las partidas viejas** (el recinto de múrgoles). Lo cogió el `/code-review`;
  se deshizo el movimiento.

## Pendiente (no es del entorno)

Jugar lo arreglado: puerta de la empalizada, ficha y menú de un edificio, testigos, viaje escrito, «Viajar»
sin montura, ganado del clan.
