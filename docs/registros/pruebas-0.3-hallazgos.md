# Ronda de pruebas del 0.3 (`QA-27`): hallazgos (vivo)

Pedida por la usuaria el 2026-10-09: jugar como una jugadora normal, buscar bugs e incoherencias y
arreglarlos. Mismo método que la [Fase G del `0.1`](fase-g-0.1-hallazgos.md).

Entorno: contenedor en la nube con Postgres local, **Ollama simulado** (`tools/ci/mock-ollama.mjs`),
backend (`npx tsx src/server.ts`, viajes acortados: `TRAVEL_SEGUNDOS_PRIMER_TRAMO=5`,
`TRAVEL_SEGUNDOS_POR_TRAMO_EXTRA=3`, `TRAVEL_SEGUNDOS_MAXIMOS=20`) y frontend (`vite`), manejados
con Chromium (Playwright). Lo determinista (interfaz, movimiento, combate, Reino) se prueba de
verdad; la calidad narrativa no (las narraciones son del simulador).

## Hallazgos

| # | Hallazgo | Estado |
|---|---|---|
| P1 | Zonas saturadas de puntos de fauna: cada especie ponía hasta 20 individuos en grupos de 1 a 4, y El Pozo de Cauce Viejo tenía 34 puntos (13 de Lebude). Moverse costaba un encuentro por paso. | ✅ 2026-10-09: 2-3 individuos sueltos por especie y el resto en pocos grupos de hasta 6 (`repartirEnGrupos`, `zonaPosicion.ts`). `reconciliarGrupos` encaja el reparto deseado sobre las filas que hay, así que las partidas de antes se consolidan solas en el siguiente turno. El Pozo: de 34 a 12 puntos de fauna. Tests en `zonaPosicion.test.ts`, `zonePoints.test.ts` y `zonaGrupos.integration.test.ts`. |
| P2 | Fauna diminuta y narrativa como punto del mapa: el Lebude (avispa de 5-15 cm, agresiva) cortaba el paso sin poder ignorarlo; el Gesgurio, el Quio y el Ruptidar llenaban zonas sin aportar nada. La regla de `ampliar-lore.md` («fauna puramente narrativa/ambiental, sin habilidades») no la respetaba el mapa. | ✅ 2026-10-09: `FAUNA_AMBIENTAL` (`worldCatalog.ts`): la fauna sin habilidades de combate y la diminuta de 20 cm o menos (`FAUNA_DIMINUTA`: Lebude, Gesgurio) no tiene puntos en el mapa, no interrumpe viajes ni sale como encuentro suelto. Las partidas de antes pierden esos puntos al abrir la zona. Lo que daban al cazarlos sale de tres fuentes de recurso nuevas (Recolectar): Colmena de Lebude, Pared de arcilla de los Gesgurios y Fango de los Quios; sus poblaciones se copian a las partidas de antes la primera vez. Los Túmulos del Honor y El Campo Yermo solo tenían Ruptidar y se quedan sin puntos (excepción justificada en `zonePointsCobertura.test.ts`). Propuesta de lore para Álvaro en `propuestas-lore.md`. |
| P3 | «Huir» muestra «Destreza +5 (10/2)» con Gorhorn de Destreza 6 (la iniciativa sí da +3). | pendiente — revisar qué atributo usa la huida |
