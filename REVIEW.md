# Guía de revisión

Lo que el revisor (`/code-review`) comprueba en cada diff, además de los fallos de siempre. Son los
fallos que más se han repetido en las revisiones de las fases (retros del 2026-10-07, `QA-16`). Lo
mecánico ya lo comprueban los tests, el hook `pre-push` y la CI; aquí está lo que pide criterio.

## El mundo avanza solo

- **Salto de varios días.** Todo lo diario (`avanceDiario.ts` y lo que cuelga de él) da lo mismo en
  un salto de N días que en N veces un día: cada día usa su estación, su reserva y las bajas del
  anterior, y lo que cuenta «por semana» mira su propia semana.
- **Decimales.** La comida, el agua o el forraje con medias (2,5 por recolector) se reparten por el
  número de día (`porcionDelDia`) en vez de redondear cada día hacia abajo o guardar un resto que
  solo vive dentro de un salto.
- **Procesos de fondo enteros.** Un combate o proceso sin la jugadora se resuelve hasta el final o
  se cierra (tablas); nada queda abierto bloqueando la siguiente acción.
- **Escrituras a la vez.** Lo que puede pasar a la vez (dos pasadas del avance, una acción mientras
  corre el avance de fondo, dos clics) va bajo el candado del avance o con un update condicionado
  (`updateMany` con la condición en el `where`, `createMany` con `skipDuplicates`).

## Quién cuenta

- **Una sola vez.** Quien come, bebe o cobra se cuenta una vez (`poblacion` son los civiles; soldados
  y visitantes van aparte).
- **Por persona, solo con nombre.** Recuerdos, aprobación, rencor y lo que es «de alguien» solo valen
  para NPC con nombre; la fauna y los genéricos comparten ficha entre ejemplares.
- **Muertos y caídos.** Un muerto, convaleciente o alguien en un combate en curso no actúa: no da
  noticias, no es objetivo de un grupo, no se mueve al corral ni se recluta.
- **Del Reino es `esDelReino`.** Un viajero sin facción puede ser un asalto de bandidos: lo del Reino
  (sus partidas, sus avisos, «De paso por aquí») se filtra con `esDelReino` / `TIPOS_SIN_DUENO`,
  nunca con `factionId: null` a secas.
- **El tope cuenta al decidir.** Un tope o límite (tamaño de un ejército, plazas, equipos) entra en
  la decisión, no se recorta después: nadie sale sabiendo que va corto.

## Cada partida, lo suyo

- **Lo que nace en una partida lleva su `saveId`** (`QA-31`, retro del 2026-10-09). Una fila creada
  jugando (un lugar, un edificio, una población) es de esa partida; sin dueña, la ven todas (pasó con
  los interiores de Capital y Cuartel: se podía viajar al de otra partida). Las consultas de `Location`
  por mundo o región pasan por `lugaresVisibles` (`mundoPartida.ts`). Lo vigila
  `backend/src/scripts/locationConDuena.test.ts` para `location.create`.

## Un dato, un sitio

Retro de `QA-27` (2026-10-12, `QA-40`): tres de los diez fallos de la revisión de la ronda eran esto.

- **Mismo filtro en los dos caminos.** Si dos caminos muestran o usan lo mismo (lo que se pinta en el
  mapa y lo que te corta el paso; la lista y su detalle), filtran igual, mejor con la misma función.
  Pasó en `zona.ts`: la fauna fuera de su sitio no se pintaba, pero seguía colisionando.
- **Sin copias entre backend y frontend.** Lo que decide el backend viaja en su respuesta (un campo,
  como `currentLocation.puntoDeAgua`); una lista copiada a mano en el frontend se desfasa.
- **El filtro mira la consulta, no la página.** Lo que depende de filas vecinas (quitar una línea
  porque otra la repite) se decide contra la base: en una lista paginada, la vecina puede caer en
  otra página.

## Lo hostil y la jugadora

- **Colocar o mover algo hostil** (fauna AGRESIVA, enemigos, grupos) dice qué pasa junto a la
  jugadora, en la entrada de la zona y donde se reaparece tras morir, y lleva un test con un agresivo
  cerca de ella (`QA-51`, retro del 2026-10-12). Pasó con P82: repartir los grupos por la zona
  (P50) los dejó junto al punto de reaparición y se moría en bucle hasta la muerte permanente. Lo que
  empieza un combate respeta la gracia tras reaparecer (`enGraciaTrasRenacer`, `services/death.ts`).

## Las facciones también

- **Mismos sistemas** ([ADR 0003](docs/adr/0003-todo-viaja-de-verdad.md)). Cada mecánica que manda
  algo por el mapa (partidas, expediciones, caravanas, patrullas) dice cómo la usan las facciones y
  tiene un test para ellas. Ninguna es solo de la jugadora.

## Rutas

- **Un GET solo lee.** Descubrir, revisar o apuntar algo va en el avance diario o en la acción que lo
  causa, nunca al abrir un panel.
- **Listas del cuerpo.** Los ids que llegan en una petición se leen con `idsDelCuerpo` (solo cadenas,
  sin repetidos) y quien no puede ir se rechaza con su motivo, no se descarta en silencio.

## Roadmap y documentos

- **Tarea cerrada.** Tachada en su roadmap con `✅ fecha`, qué se hizo y qué queda, y en el mapa de
  `docs/producto/21-roadmap.md`; la bitácora al día en el mismo commit (`CLAUDE.md`).
- **Lore.** Nada editado en `docs/rpgtarkor/` (`AGENTS.md`); las propuestas, en
  `docs/borradores-opencode/propuestas-lore.md`.
