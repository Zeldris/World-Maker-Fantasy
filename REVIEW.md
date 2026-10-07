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

## Las facciones también

- **Mismos sistemas** ([ADR 0003](docs/adr/0003-todo-viaja-de-verdad.md)). Cada mecánica que manda
  algo por el mapa (partidas, expediciones, caravanas, patrullas) dice cómo la usan las facciones y
  tiene un test para ellas. Ninguna es solo de la jugadora.

## Roadmap y documentos

- **Tarea cerrada.** Tachada en su roadmap con `✅ fecha`, qué se hizo y qué queda, y en el mapa de
  `docs/producto/21-roadmap.md`; la bitácora al día en el mismo commit (`CLAUDE.md`).
- **Lore.** Nada editado en `docs/rpgtarkor/` (`AGENTS.md`); las propuestas, en
  `docs/borradores-opencode/propuestas-lore.md`.
