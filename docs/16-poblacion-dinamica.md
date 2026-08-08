# Población dinámica y encuentros ambientales (diseño + implementación, 2026-08-03)

**Estado:** implementado.
**Origen:** petición explícita de la usuaria tras jugar una partida larga: "entramos en bucles
continuados sin salir de la propia zona o sin encontrar nuevos enemigos en las zonas" — pidió
diseñar un sistema de encuentros/vida del mundo apoyado en `WorldPopulation` (sembrado desde
2026-07-29, nunca leído por ningún código de partida hasta ahora).

## 1. El problema

- `WorldPopulation` (`poblacion`/`poblacionMax`/`distribucion` por raza y fauna) existía solo como
  datos semilla — ninguna acción de partida los leía ni los modificaba.
- Los encuentros ambientales (`pickAmbientEncounterCandidate`, `turnResolution.ts`) elegían al azar
  entre TODA la fauna itinerante del mundo, sin filtrar por región ni ponderar por abundancia real
  — la misma probabilidad de cruzarte con un Corredor de Cauce (Llanuras) que con un Cornante
  (Ciénaga Troncal) estando en cualquiera de las dos regiones.
- Matar/Decapitar a un NPC no tenía ningún efecto sobre la población de su especie/raza — no había
  manera de que una especie se volviera más rara ni de que se extinguiera de verdad.

## 2. Decisiones de diseño (iteradas con la usuaria)

1. **Los NPC con nombre propio (PRINCIPAL) también cuentan** para la depleción de su raza —
   matar a Torgash resta 1 a `orcos-llanuras`, igual que matar un Múrgol genérico resta 1 a
   `murgol`. No es solo fauna genérica.
2. **Sin techo de población por ahora** ("no quiero un techo de población de momento") —
   `poblacionMax` NO actúa como límite duro que frene el crecimiento. Se queda como la cifra de
   referencia ya sembrada, sin un uso mecánico nuevo todavía.
3. **Umbral mínimo de reproducción = 4** — por debajo de 4 individuos, la especie/raza no crece
   ese ciclo (muy pocos para encontrar pareja). A partir de 4, crece con normalidad.
4. **Crecimiento proporcional a la población actual** ("cuanta más población más rápido aumenta,
   cuanta menos población más difícil que suba") — el crecimiento se calcula como
   `poblacion × tasa`, nunca como una cifra fija: con más individuos el crecimiento absoluto es
   mayor, con pocos es pequeño incluso por encima del umbral de 4.
5. **La fauna se reproduce más rápido que las razas de NPC** — tasa categórica distinta por
   `targetType` (`FAUNA` bastante más alta que `RAZA`), no solo ajuste fino por especie.
6. **Extinción real y permanente** — si `poblacion` llega a 0, no hay crecimiento espontáneo (el
   umbral del punto 3 lo impide) y la especie/raza queda extinta hasta que un sistema futuro
   (guerra, caza dinámica, migración) la repueble desde otra región — no existe hoy, es diseño
   futuro.
7. **Guerra/caza dinámica del entorno/otros eventos — aplazado a fase 2**, explícitamente por
   decisión de la usuaria ("en el futuro o ahora si ves que no se desvía mucho..."). Este documento
   deja el terreno preparado (cualquier evento futuro solo necesita llamar a la misma función de
   decremento/incremento que ya existe) pero no lo implementa.

## 3. Mecanismo técnico

### 3.1 Mapeo NPC → fila de `WorldPopulation`

`populationTargetSlugFor(raza, slug, region)` en `backend/src/services/population.ts`:

- Fauna (`raza === null`): la fila es `targetSlug === Npc.slug` directamente — cada especie de
  fauna en `worldCatalog.ts` ya es una fila 1:1 en `worldPopulation.ts`.
- Razas de un solo territorio (`goirntes`/`nabieus`/`faerus`): `targetSlug === raza`.
- Orcos (3 clanes regionales, biología distinta entre ellos — decisión ya cerrada en
  `worldPopulation.ts`): `targetSlug` es `orcos-${sufijo de región}` (`llanuras` /
  `cristal-helado` / `cienaga`), resuelto a partir de la región ACTIVA de la escena
  (`activeRegion`, ya calculado en `turnResolution.ts` para el lint de región) — no de
  `homeLocationSlug`, para que un orco de Serhu muerto en Cristal Helado (itinerante) cuente donde
  cae, no donde "vive" nominalmente.
- Si no hay fila que corresponda (NPC sin raza y sin fila de fauna, o región sin mapeo de sufijo),
  la función devuelve `null` y no se toca nada — nunca inventa una fila.

### 3.2 Decremento al morir

`decrementPopulationOnDeath(tx, worldId, raza, slug, region)` — llamado dentro de la MISMA
transacción de `turnResolution.ts`, en los dos sitios donde un NPC pasa a `MUERTO`:

- Golpe de combate letal (bloque de `npcAttackTarget`).
- "Decapitar" (bloque de `executeTargets`).

Resta 1, sin bajar de 0 (`Math.max(0, poblacion - 1)`). No dispara nada si no encuentra fila
(`populationTargetSlugFor` devolvió `null`) — mismo criterio de "no bloquear el turno si el dato no
existe" que el resto del motor.

**No se descuenta en `INCAPACITADO`** — solo en `MUERTO`: quedar inconsciente no reduce la
población, coherente con que solo `INCAPACITADO`/`MUERTO` son saqueables pero solo `MUERTO` es
una baja real (ver memoria de progresión de condición).

### 3.3 Crecimiento — prorrateado por tiempo real, no por tick

Cada fila de `WorldPopulation` ya tiene `updatedAt` (`@updatedAt` de Prisma). El crecimiento se
calcula en `growAllPopulations()`, llamado desde `tick()` en `worldTick.ts` (mismo cadencia que
`resolveDueTransits`, cada `env.worldTickIntervalMinutes`):

```
elapsedDays = (ahora - fila.updatedAt) / MS_POR_DIA
si fila.poblacion < 4: no crece (se salta, no se toca la fila)
delta = floor(fila.poblacion × tasa[fila.targetType] × elapsedDays)
si delta >= 1: fila.poblacion += delta   (única condición que dispara un `update`)
```

Guardar solo cuando `delta >= 1` es intencionado: si actualizáramos la fila en cada tick aunque el
delta calculado fuera 0, `updatedAt` se resetearía constantemente y el crecimiento nunca llegaría a
acumularse lo suficiente para cruzar el entero siguiente. Al dejar la fila intacta cuando no hay
crecimiento entero todavía, el tiempo transcurrido se seguirá acumulando en el siguiente tick hasta
que sí lo cruce — el tick puede correr cada 2 minutos sin que la tasa "por día real" se descontrole.

Tasas de partida (`GROWTH_RATE_PER_DAY`, en `population.ts`, fácilmente ajustables):
`FAUNA: 0.02` (2%/día), `RAZA: 0.003` (0.3%/día), `RECURSO: 0.01` (1%/día, ver § 3.5) — la fauna
crece ~7× más rápido que las razas de NPC, coherente con "lógicamente la fauna tiene más
posibilidades de reproducirse que una raza de NPC". Son valores de partida, no un cierre
definitivo — ajustar con confianza si al jugar se ve demasiado rápido/lento.

Como `WorldPopulation` es del `World`, no de una `Save` concreta, el crecimiento se comparte entre
todas las partidas de ese mundo — coherente con que ya era así de diseño ("un único número global,
nunca partido por partida").

### 3.4 Encuentros ambientales: ponderados por población real y filtrados por región

Antes: `pickAmbientEncounterCandidate` elegía uniformemente entre TODA la fauna itinerante del
mundo (`kind: 'PLANTILLA', homeLocationSlug: null`), sin mirar la región activa ni la abundancia.

Ahora, en `turnResolution.ts`:

1. Se cruzan los candidatos itinerantes con sus filas `WorldPopulation` (`targetType: 'FAUNA'`,
   `targetSlug === slug`).
2. Se filtra a los que tengan peso > 0 en la región activa (`distribucion[activeRegion] > 0`) —
   un Cornante (solo Ciénaga Troncal) ya no puede "aparecer" en Cristal Helado.
3. Se excluyen las filas con `poblacion === 0` — una especie extinta deja de aparecer como
   encuentro ambiental de verdad, no solo narrativamente.
4. `pickAmbientEncounterCandidate` (extendida con un `weight` opcional por candidato, por defecto
   1 — no rompe el uso uniforme existente) elige con probabilidad proporcional a `poblacion`: las
   especies abundantes (Corredor de Cauce, 4500) aparecen mucho más que las raras (Gargantúa de
   Ceniza, 60), y la abundancia cambia de verdad según lo que la jugadora haya cazado.

Esto conecta directamente el sistema con la queja original: cazar mucho una especie en una zona la
hace más rara de encontrar ahí (y finalmente puede desaparecer), mientras las zonas que se dejan en
paz mantienen variedad — sin tocar nada del resto del motor de encuentros (sigue siendo solo una
SUGERENCIA opcional para el modelo, 25% de probabilidad, nunca fuerza combate).

### 3.5 RECURSO — recolección de profesiones sin gastar turno (añadido 2026-08-07)

Tercer `targetType` además de `FAUNA`/`RAZA` (rediseño de profesiones recolectoras: minería/tala) —
mismo mecanismo de crecimiento de § 3.3, tasa propia (`RECURSO: 0.01`, entre fauna y raza). La
diferencia está en cómo se depleciona: no viene de matar a un NPC, viene de recolectar de verdad.

- `GET /saves/:id/recolectar/:oficio` (`recolectar.ts`) usa la fila `WorldPopulation` (tipo
  `RECURSO`, `poblacion > 0`, `distribucion[región activa] > 0`) para decidir qué ofrecer en el
  pop-up de "Minar"/"Talar" — determinista, sin narrar nada ni gastar turno.
- `POST /saves/:id/recolectar/confirmar` decrementa `poblacion` atómicamente (mismo guard
  `poblacion: { gte: cantidad }` que `decrementPopulationOnDeath`), validado contra `HarvestYield`
  para no permitir ni un objeto que no sea un yield real de esa fuente ni una cantidad por encima
  del máximo real por recolección (`HarvestYield.cantidad` — bug real de la auditoría de código
  completa 2026-08-07, ver memoria de esa auditoría: antes solo topaba por población total).

## 4. Fuera de alcance a propósito

- **Guerra, caza dinámica ambiental, migraciones y otros eventos de mundo** que reduzcan/redistribuyan
  población sin intervención directa de la jugadora — aplazado a fase 2 por la propia usuaria. El
  terreno queda listo: cualquier evento futuro solo tiene que llamar a
  `decrementPopulationOnDeath`/una función de incremento equivalente sobre la fila que corresponda.
- **Anti-repetición de encuentros ambientales** (no sugerir el mismo NPC/especie en turnos
  consecutivos) — parte de la propuesta original de encuentros, no pedida explícitamente en esta
  ronda de diseño, queda anotada como mejora menor futura.
- **Redistribución entre regiones** (`distribucion` cambiando con el tiempo) — hoy sigue anclada
  como semilla fija; solo tendría sentido con el sistema de migraciones de guerra de la fase 2.
