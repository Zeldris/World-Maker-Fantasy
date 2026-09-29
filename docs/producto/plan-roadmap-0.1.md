# Plan de ejecución — hito `0.1` Llanuras estable

**Creado:** 2026-09-29. Roadmap: [21-roadmap.md § 0.1](21-roadmap.md#01--llanuras-estable-).
**Punto de partida:** `v0.0.0-alpha` (`44f8ba3`).
**Forma de trabajo** (la misma de Alpha 0): Opus planifica y revisa; los agentes Sonnet implementan
**de uno en uno**; Opus pasa las suites, commitea, sube a la rama y a `main` y tacha en el roadmap.

## Reglas comunes para cada agente

- Leer `AGENTS.md`. No tocar `docs/` (lo actualiza Opus). Comentarios en español con el estilo del
  código de alrededor.
- Postgres: `postgresql://tarkor:tarkor@localhost:5432/tarkor`. Si está caído, `bash
  /home/user/devenv/up.sh` y **después `bash /home/user/stop-be.sh`**: el backend arrancado corre
  `worldTick` contra la misma base de datos y vuelve intermitentes los tests de integración.
- Migraciones: `npx prisma migrate diff` + `npx prisma migrate deploy` (la base de datos de sombra no
  tiene pgvector) y `npx prisma generate`.
- Terminar con backend (`tsc`, `vitest run` completo, salida 0, sin "Unhandled Rejection") y
  frontend (`tsc -b`, `vitest run`, `lint` sin avisos nuevos) en verde.
- Hito congelado: nada de funcionalidades nuevas grandes que no estén en este plan.

## Fase A — Integración continua en verde

La CI de GitHub (`.github/workflows/ci.yml`) lleva en rojo desde que existen los tests de
integración con Postgres real (proyecto `bd-real` de Vitest): su comentario aún dice que "ningún
test necesita base de datos".
- Servicio Postgres 16 con pgvector en el job de backend, `prisma migrate deploy` y `seed-catalog`
  antes de `npm test`.
- Confirmar que la suite completa pasa en CI y dejar el comentario al día.

## Fase B — Versión visible y partidas que sobreviven a una actualización

- (En curso el 2026-09-29) versión `A.P.C-etapa+commit` en el juego y en `/version`, y
  `versionCreada`/`versionUltimaPartida` en cada partida.
- **Resincronizar objetos de catálogo en partidas existentes**: script idempotente (enganchado en
  `actualizar-mundo.sh` e `iniciar-tarkor.sh`, tras el seed) que pone al día `statBonuses` de
  `InventoryItem` y `AlmacenItem` con `catalogSlug`, y desequipa al inventario lo que ya no cabe en
  su ranura (capa de melena de Ferike, tocado de plumas y cinturón de trofeos, que pasaron a
  cosméticos el 2026-09-29). Nunca toca objetos sin `catalogSlug`.
- Test de integración con una partida "antigua".

## Fase C — Test intermitente de combate múltiple

`combateMultipleOrquestacion.integration.test.ts` falla de vez en cuando solo en la suite completa
(registro de deuda, 2026-09-29). Buscar la causa raíz (estado compartido entre ficheros, orden de
`findMany` sin `orderBy`, dados sin fijar…) y arreglarla. Nunca saltar ni desactivar el test.

## Fase D — El mundo vivo, visible

- Noticias en el registro de la partida (canal "El mundo") cuando una expedición de facción vuelve
  con botín, es interceptada o tiene bajas, y cuando una relación entre facciones cambia de banda
  (p. ej. de TENSION a GUERRA). Solo lo que el personaje podría saber: facciones de su región o con
  las que tiene reputación.
- **Migrar `worldAgenda.ts`** a `FactionRelation`: el conflicto fijo Serhu+Concordia contra
  Helsig+Goshg pasa a leerse de las relaciones reales (sembradas el 2026-09-29), sin cambiar lo que
  ve el jugador hoy.

## Fase E — Súbditos del Reino, versión mínima 🧭

Bloqueada hasta que Álvaro revise la propuesta de población en `propuestas-lore.md`. Alcance
mínimo previsto: vivienda con plazas y llegada semanal de un poblador desde la población de su
raza en la región (tarjeta aceptar/rechazar), que pasa a ser un súbdito (`Companion` con
`rolReino`).

## Fase F — Latencia en la Steam Deck

Script `backend/src/scripts/benchmark-turno.ts` que juega N turnos típicos contra el backend y el
Ollama reales y saca tiempos por fase (clasificar, resolver, narrar). Álvaro lo ejecuta en la
Steam Deck; con los números se fija el objetivo de turno en el roadmap.

## Fase G — Pasada de juego completa (Opus, con el navegador)

Guion: primer turno y Gistera; zona y movimiento; caza en solitario y en grupo (aviso de riesgo);
cadáveres, saqueo y Goirnos; recolección con cada método (ficha de flora); combate con muerte y
renacer; compañeros; Reino (fundar, construir, taller con trabajador, diplomacia con XP, mercado,
súbditos si la fase E está hecha). Cada fallo va a `docs/registros/` y se arregla en esta misma fase
con un agente por lote.

## Cierre

Guion jugado sin bloqueos, CI en verde, latencia medida → etiqueta `v0.1.0-alpha` (la sube Álvaro
desde su máquina: el proxy de esta sesión no deja subir etiquetas).
