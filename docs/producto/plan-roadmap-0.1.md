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

✅ **Hecha** (2026-09-29, `ci.yml`): Postgres 16 + pgvector, migraciones, Ollama simulado,
`reindex-lore` y `seed-catalog`. Desde entonces lo único rojo era el test intermitente de la Fase C.

## Fase B — Versión visible y partidas que sobreviven a una actualización

- ~~Versión `A.P.C-etapa+commit` en el juego y en `/version`, y
  `versionCreada`/`versionUltimaPartida` en cada partida~~ ✅ `bf473bc`.
- ✅ `0bc4867` **Resincronizar objetos de catálogo en partidas existentes**: script idempotente (enganchado en
  `actualizar-mundo.sh` e `iniciar-tarkor.sh`, tras el seed) que pone al día `statBonuses` de
  `InventoryItem` y `AlmacenItem` con `catalogSlug`, y desequipa al inventario lo que ya no cabe en
  su ranura (capa de melena de Ferike, tocado de plumas y cinturón de trofeos, que pasaron a
  cosméticos el 2026-09-29). Nunca toca objetos sin `catalogSlug`.
- Test de integración con una partida "antigua".

## Fase C — Test intermitente de combate múltiple

`combateMultipleOrquestacion.integration.test.ts` falla de vez en cuando solo en la suite completa
(registro de deuda, 2026-09-29). Buscar la causa raíz (estado compartido entre ficheros, orden de
`findMany` sin `orderBy`, dados sin fijar…) y arreglarla. Nunca saltar ni desactivar el test.

✅ **Hecha** (2026-10-01). Causa raíz: fallo del test, no del motor. En "ANALIZAR RIVAL: contra un
miembro de grupo…", `iniciarCombatEncounter` ya calcula los enganches de la ronda 1: el primer
miembro del grupo en iniciativa reclama a la jugadora y, por la regla 3 del enganche, ella queda en
duelo con él (`fijarEleccionRondaJugador` no cambia nada). El test daba por hecho que analizaba la
primera fila de un `findMany` sin `orderBy`, y solo coincidía cuando la tirada de iniciativa ponía
esa fila delante (falló ~1 de cada 12 en local). Ahora toma como analizado al rival con el que la
jugadora está realmente en duelo: 25/25 en bucle y suite completa 162/162 con Postgres real.

Segundo test intermitente, aparecido ya con la CI en marcha (2026-10-02): el bloque
`OrdenProduccion` de `turn.integration.test.ts` (y el de consolidación de territorio, mismo helper
`doPassiveTurn`). Con banda `larga`, `/turn/classify` crea un `CharacterTransit` y lanza
`startEagerTransitResolution` en segundo plano; el `/turn/narrate` del test competía con ella por el
candado de turno y, si ganaba la de fondo, no persistía hasta `busyUntil` (30 min reales): el tick
diario no se veía (~1 de cada 5). También seguía viva tras borrar la partida (error de FK de
`ZonePoint` en los logs de la CI). Es del test, no del juego (el frontend nunca llama a narrate tras
un tránsito): `doPassiveTurn` narra directo con la clasificación del mock. 25/25 en bucle (antes
3/15 en rojo) y suite completa 162/162.

## Fase D — El mundo vivo, visible

- Noticias en el registro de la partida (canal "El mundo") cuando una expedición de facción vuelve
  con botín, es interceptada o tiene bajas, y cuando una relación entre facciones cambia de banda
  (p. ej. de TENSION a GUERRA). Solo lo que el personaje podría saber: facciones de su región o con
  las que tiene reputación.
  ✅ **Hecho** (2026-10-02): `services/noticiasMundo.ts` (textos deterministas, filtro de
  conocimiento y reparto a las partidas del mundo, nunca a una cuyo reloj no ha llegado a ese día),
  enganchado en `factionExpeditions.ts` (vuelta con botín, asalto rechazado o con carga perdida,
  cambio de banda provocado por un asalto). Para verlas sin recargar: `GET /saves/:id/mundo/nuevas`
  y el hook `useNoticiasMundo` (al terminar cada turno y cada 2 min). Los cambios de banda que causa
  el propio jugador ya iban a su registro. **Pendiente para 0.2:** cambios de banda por la economía
  de facción y noticias de otras fuentes (pasarán a sucesos del Cronista).
- **Migrar `worldAgenda.ts`** a `FactionRelation`: el conflicto fijo Serhu+Concordia contra
  Helsig+Goshg pasa a leerse de las relaciones reales (sembradas el 2026-09-29), sin cambiar lo que
  ve el jugador hoy.
  ✅ **Hecho** (2026-10-02): el control de Cristal Helado y Ciénaga Troncal sale de Serhu→Helsig y
  Serhu→Goshg (`regionControlActual`, usado por `zona.ts` y por el contexto del narrador); con la
  presión sembrada (70, etapa 1) el resultado es el de antes. El temporizador de 7 días se mantiene
  pero ahora **empuja** esas relaciones (sube la presión al mínimo de su etapa, nunca la baja) y
  sincroniza partidas que ya iban más avanzadas; textos y bajas de población, igual. Sin relación en
  BD se usa la agenda como antes. De paso: `factionRelations.integration.test.ts` borraba la
  relación sembrada Serhu→Helsig al terminar; ahora la restaura.
  **Pendiente para 0.2:** que el conflicto avance por sucesos reales y no por temporizador (motor de
  eventos del Cronista) y que la Concordia→Helsig/Goshg cuente.

✅ **Fase D cerrada** el 2026-10-02 (sin el Libro de Sucesos `CR-1`…`CR-4`, que sigue pendiente de
la decisión de Álvaro).

## Fase E — Súbditos del Reino, versión mínima 🧭

Bloqueada hasta que Álvaro revise la propuesta de población en `propuestas-lore.md`. Alcance
mínimo previsto: vivienda con plazas y llegada semanal de un poblador desde la población de su
raza en la región (tarjeta aceptar/rechazar), que pasa a ser un súbdito (`Companion` con
`rolReino`).

## Fase F — Latencia en la Steam Deck

Script `backend/src/scripts/benchmark-turno.ts` que juega N turnos típicos contra el backend y el
Ollama reales y saca tiempos por fase (clasificar, resolver, narrar). Álvaro lo ejecuta en la
Steam Deck; con los números se fija el objetivo de turno en el roadmap.

🚧 **Script hecho** (2026-10-02): `npm run benchmark-turno -- [--turnos 5] [--url …] [--save <id>]
[--conservar] [--salida informe.json]` con el backend arrancado. Crea una partida de Gorhorn (la
borra al acabar), juega acciones cortas típicas y mide clasificar, resolver (hasta la primera línea
del stream de narración) y narrar (hasta `done`); imprime mediana, p90 y máximo y guarda un JSON con
máquina, modelos y versión. Probado en local contra el Ollama simulado. **Falta (Álvaro):**
ejecutarlo en la Steam Deck con el Ollama real y pasar el JSON para fijar el objetivo de turno.

## Fase G — Pasada de juego completa (Opus, con el navegador)

Guion: primer turno y Gistera; zona y movimiento; caza en solitario y en grupo (aviso de riesgo);
cadáveres, saqueo y Goirnos; recolección con cada método (ficha de flora); combate con muerte y
renacer; compañeros; Reino (fundar, construir, taller con trabajador, diplomacia con XP, mercado,
súbditos si la fase E está hecha). Cada fallo va a `docs/registros/` y se arregla en esta misma fase
con un agente por lote.

## Cierre

Guion jugado sin bloqueos, CI en verde, latencia medida → etiqueta `v0.1.0-alpha` (la sube Álvaro
desde su máquina: el proxy de esta sesión no deja subir etiquetas).
