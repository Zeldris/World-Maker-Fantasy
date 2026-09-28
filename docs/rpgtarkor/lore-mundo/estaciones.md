# Sistema de estaciones (2026-08-24) — APLICADO al motor

Diseño cerrado con la usuaria para el ítem "Sistema de estaciones por mes/región" de
[21-roadmap.md](../../producto/21-roadmap.md). Motiva el cierre del último sub-caso bloqueado de
`HarvestYield.condicion` (`boungo`, "crece en otoño") — el otro sub-caso bloqueado
(`punado-arena-iman`/`esquirla-celeste-caida`, tormentas de arena) es un sistema distinto
("Eventos de clima puntuales"), sigue sin diseñar, no se toca aquí.

## Grounding

- El motor ya lleva tiempo de ficción en `WorldState.fictionalMinutes`
  (`backend/src/services/worldClock.ts`), con `MINUTES_PER_DAY = 1440` y `dayForFictionalMinutes`
  dando ya un "Día N" 1-indexado. No existe mes ni año — comentario explícito en el propio archivo:
  "año todavía no implementado".
- La franja horaria (`franjaHorariaFor`, `entorno.ts`) se calcula **pura**, a partir de la hora del
  día — no se guarda nada en BD. Estaciones sigue el mismo patrón.
- Solo Las Llanuras del Viento Rojo tiene núcleo jugable real hoy (`entorno.ts`) — un calendario
  desfasado por región no tendría forma de probarse en vivo, así que el calendario es único y
  global.
- Ya hay precedente real de texto condicionado por raza del personaje jugable:
  `razaFor(characterName)` (`backend/src/services/berigLore.ts:364`, hoy solo reconoce
  `'Gorhorn' → 'orcos'`) y su uso en `dynamicAbilities.ts`/`npcCombatAbilities.ts` para elegir
  nombre/descripción de habilidad según raza. El nombre de estación mostrado sigue el mismo patrón.
- Anclas de lore ya existentes que las 4 estaciones recogen sin inventar nada:
  - "la estación de las crecidas" — cuándo se reúne el Clan Goshg en Makut Silh (`areas.md:131`).
  - Migraciones estacionales de las Gargantúas de Ceniza (`flora-fauna.md:28`).
  - Boungo "crece en otoño" (`flora-fauna.md:125`).
  - Kirelon Arenoso y sus "largos inviernos" (`flora-fauna.md:67`).

## Calendario

Único, global, 120 días de ficción por año, 30 días por estación. El Día 1 de cualquier partida
nueva empieza en Ur'gathek.

```
estacionFor(fictionalMinutes) = floor((diaDelAño - 1) / 30) % 4
  donde diaDelAño = ((dayForFictionalMinutes(fictionalMinutes) - 1) % 120) + 1
```

## Las 4 estaciones

Nombre nativo en Kektira (lengua propia de los clanes orcos, `areas.md:18`) con glosa en lengua
común — mismo doblete que ya usan los topónimos del mundo (p. ej. "El Cerco de los Pilotes" /
Makut Silh).

| # | Clave interna | Nombre Kektira (orcos) | Glosa común | Ancla de lore |
|---|---|---|---|---|
| 0 | `PRIMAVERA` | **Ur'gathek** | la estación de las crecidas | Reunión anual del Clan Goshg en Makut Silh (`areas.md:131`) |
| 1 | `VERANO` | **Sohkar** | la estación seca | — |
| 2 | `OTONO` | **Vungrat** | la estación de la cosecha | Boungo crece, Corretolvas migran (`flora-fauna.md:125`) |
| 3 | `INVIERNO` | **Krenoth** | la estación larga | Kirelon Arenoso emerge en "largos inviernos" (`flora-fauna.md:67`) |

**Nombre mostrado según raza del personaje jugable**: `estacionNombreFor(estacion, raza)` — si
`raza === 'orcos'` (hoy siempre, vía `razaFor(characterName)`), se usa el nombre Kektira; para
cualquier otra raza o `raza` desconocida, se usa la glosa en lengua común. La mecánica (qué estación
es "ahora mismo", y por tanto qué `HarvestYield.condicion` se cumple) compara siempre contra la
**clave interna** (`OTONO`, no `Vungrat` ni "la estación de la cosecha"), así que el nombre que se
narre no afecta a qué se puede recolectar.

## Aplicación a `HarvestYield.condicion`

`boungo` (`worldCatalog.ts:5169-5176`, hoy `condicion: 'crece en otoño'` sin mecánica real detrás)
pasa a exigir `estacionFor(fictionalMinutes) === 'OTONO'` para aparecer como candidato de
recolección — mismo tratamiento que ya reciben `sinTirada`/`requiereHerramienta`/`metodoObtencion`
en la ronda de `HarvestYield.condicion` cerrada el 2026-08-24.

## Fuera de alcance de este diseño

- Temperatura, clima o efectos de estación sobre combate/viaje/supervivencia — no se diseñan aquí,
  ni se necesitan para desbloquear a `boungo`.
- Eventos de clima puntuales (tormentas de arena) — sistema aparte, sigue sin diseñar, bloquea
  `punado-arena-iman`/`esquirla-celeste-caida`.
- Calendario desfasado por región — cuando exista una segunda región jugable real, se puede añadir
  un offset por región sin romper este diseño (la función seguiría siendo pura, solo tomaría
  `region` como segundo parámetro).
- Nombres de estación en otras lenguas (Geniha, Kerost) para otras razas jugables — hoy no hace
  falta porque Gorhorn es el único personaje jugable; se añade cuando haga falta de verdad, mismo
  criterio de "no añadir paja" ya aplicado a los items huérfanos.

## Aplicado al motor (2026-08-24)

- `estacionFor(fictionalMinutes)`/`estacionNombreFor(estacion, raza)` en `worldClock.ts`, puras,
  sin persistencia — mismo patrón que `dayForFictionalMinutes`/`franjaHorariaFor`.
- Enum `Estacion` (`PRIMAVERA`/`VERANO`/`OTONO`/`INVIERNO`) y campo `HarvestYield.estacionRequerida`
  (nullable) en el schema — migración `20260824000000_harvest_yield_estacion_requerida`.
- `boungo` (`worldCatalog.ts`) ya lleva `estacionRequerida: 'OTONO'`.
- `candidateSourcesFor`/`carcassCandidatesFor` (`recolectar.ts`) filtran por estación ANTES de la
  tirada — un recurso fuera de temporada ni siquiera cuenta como candidato, mismo punto que ya
  ocupaba el filtro de terreno.
- Tests: `worldClock.test.ts` (estacionFor/estacionNombreFor), `recolectar.test.ts` (2 casos nuevos
  del gate). `tsc -b` limpio, sin regresiones (suite completa, mismo baseline de Postgres no
  disponible en sandbox).

**Pendiente de tu lado** (no gestiono tu Postgres): aplicar la migración nueva contra tu BD real
(`npm run prisma:migrate` o el flujo que uses) y volver a correr `npm run seed-catalog` para que
`estacionRequerida: 'OTONO'` llegue a la fila de `boungo` ya sembrada.

## Fuera de alcance, detectado de paso

El Kirelon Arenoso (`docs/rpgtarkor/lore-mundo/flora-fauna.md`) sigue con su nota de "largos inviernos" sin
mecánica real — pero a diferencia de `boungo`, no es un `HarvestYield.condicion`: sus 4 filas
(hueso/cráneo/piel/garras) son todas `metodoObtencion: CAZA` sin ninguna condición de estación en
texto. Lo que describe "largos inviernos" es si el propio Kirelon APARECE en la escena (tasa de
encuentro/población), no qué se despieza de él una vez muerto — sistema distinto (encuentros
ambientales por estación), no se toca en esta pasada.
