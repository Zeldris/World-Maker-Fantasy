# Clima real de Las Llanuras: tormentas y vientos (2026-08-24) — APLICADO al motor

Diseño cerrado con la usuaria para el ítem "Eventos de clima puntuales" de
[21-roadmap.md](../21-roadmap.md) — distinto del [sistema de estaciones](estaciones.md) (que ya
existe, un eje de tiempo aparte): esto es la dureza real de vivir en Las Llanuras del Viento Rojo,
no solo un gate mecánico de 2 objetos.

## Grounding

- `punado-arena-iman`/`esquirla-celeste-caida` (`worldCatalog.ts:4670-4692`), ambos `sourceSlug:
  'arena-iman'`. `arena-iman` YA tiene `WorldPopulation` sembrada (`worldPopulation.ts:257-264`,
  población 500) — a diferencia de `boungo`, hoy este recurso aparece SIEMPRE, la `condicion`
  ("solo tras una tormenta de arena magnética reciente" / "tras una tormenta fuerte") es puro texto
  sin efecto real, mismo síntoma que tenía `boungo` antes de cerrar estaciones.
- No hay ningún precedente de "evento temporal con estado guardado" en el motor (solo cooldowns
  fijos y `Save.harvestRollCache`) — se sigue el mismo patrón puro que `estacionFor` (worldClock.ts):
  nada se persiste, todo se recalcula a partir de `fictionalMinutes` + región.
- Las Agujas Imán está en Las Llanuras del Viento Rojo (`lugarOrigen`, `worldCatalog.ts:3535`), la
  única región con núcleo jugable real hoy.

## Los 3 estados de clima de Las Llanuras

De 120 días de ficción al año, la usuaria cerró las cifras: **40 días de gran tormenta, 40 de
vientos fuertes, solo 40 llevables** — "siendo duro realmente vivir en esta región". Un cuarto
estado, **Tormenta Extrema**, es 1 de cada 3 días de gran tormenta (~14 días/año): la que además
puede dar la esquirla.

Nombre Kektira (lengua propia de los clanes orcos) para el personaje jugable orco, mismo patrón que
[estacionNombreFor](estaciones.md) — glosa en lengua común como fallback para cualquier otra raza:

| Estado | Días/año | Umbral | Nombre Kektira (orcos) | Glosa común |
|---|---|---|---|---|
| Clima Llevable | 40 | 0 | **Ghurmek** | el respiro |
| Vientos Fuertes | 40 | 1 | **Sek'tar** | el viento cortante |
| Tormenta Grande | ~27 (2 de cada 3 días de tormenta) | 2 | **Rokthar** | la gran tormenta |
| Tormenta Extrema | ~13 (1 de cada 3 días de tormenta) | 3 | **Rok'ithek** | la ira del viento |

`Rok'ithek` deriva a propósito de `Rokthar` (misma raíz, terminación distinta) — es la versión
intensificada de la misma tormenta, no un fenómeno aparte, igual que mecánicamente
`TORMENTA_EXTREMA` es "al menos" `TORMENTA_GRANDE` (orden de severidad, no una categoría separada).

## Cálculo (puro, sin persistencia)

Ciclo repetido de 3 días (Tormenta/Viento/Calma) a lo largo del año de 120 días — da exactamente 40
de cada uno. Dentro de los días de tormenta, 1 de cada 3 se marca Extrema:

```
climaFor(fictionalMinutes, region):
  si region !== 'Llanuras del Viento Rojo': null (sin diseño en otras regiones, nunca bloquea)
  diaDelAño = ((dayForFictionalMinutes(fictionalMinutes) - 1) % 120) + 1
  posicionCiclo = (diaDelAño - 1) % 3   // 0 = tormenta, 1 = viento, 2 = calma
  si posicionCiclo == 1: VIENTO_FUERTE
  si posicionCiclo == 2: CLIMA_LLEVABLE
  // posicionCiclo == 0: día de tormenta — ¿cuál de los 40?
  numeroTormenta = floor((diaDelAño - 1) / 3)   // 0..39
  si numeroTormenta % 3 == 0: TORMENTA_EXTREMA
  si no: TORMENTA_GRANDE
```

## Aplicación a `HarvestYield`

Campo nuevo `climaRequerido: EstadoClima?` (enum `CLIMA_LLEVABLE < VIENTO_FUERTE < TORMENTA_GRANDE
< TORMENTA_EXTREMA`, orden de severidad) — a diferencia de `estacionRequerida` (igualdad exacta),
aquí el filtro es "al menos esta severidad": `climaFor(...) >= climaRequerido`.

- `punado-arena-iman`: `climaRequerido: 'TORMENTA_GRANDE'` (aparece en Grande o Extrema).
- `esquirla-celeste-caida`: `climaRequerido: 'TORMENTA_EXTREMA'` (solo en Extrema — sigue sin
  garantía, la tirada de recolección decide cantidad/aparición dentro de esos días).

## Aplicado al motor (2026-08-24)

- `climaFor(fictionalMinutes, region)`/`climaSeveridadAlMenos`/`climaNombreFor` puros en
  `worldClock.ts`, mismo patrón sin persistencia que `estacionFor`.
- Enum `EstadoClima` y campo `HarvestYield.climaRequerido` (nullable) — migración
  `20260824010000_harvest_yield_clima_requerido`.
- `punado-arena-iman`/`esquirla-celeste-caida` (`worldCatalog.ts`) ya llevan `climaRequerido`.
- `candidateSourcesFor`/`carcassCandidatesFor` (`recolectar.ts`) filtran por severidad MÍNIMA antes
  de la tirada, mismo punto que estación/terreno.
- Tests: `worldClock.test.ts` (climaFor/climaSeveridadAlMenos/climaNombreFor), `recolectar.test.ts`
  (2 casos nuevos del gate, incluyendo el umbral "al menos" con Tormenta Extrema superando el
  requisito de Tormenta Grande). `tsc -b` limpio, sin regresiones nuevas.

**Pendiente de tu lado** (no gestiono tu Postgres): aplicar la migración nueva contra tu BD real y
volver a correr `npm run seed-catalog` para que `climaRequerido` llegue a las 2 filas ya sembradas.

## Fuera de alcance de este diseño

- Efectos de clima sobre combate/viaje/visibilidad — solo gate de recolección, nada más.
- Clima de otras regiones (Cristal Helado, Ciénaga Troncal...) — sin diseñar, `climaFor` devuelve
  `null` ahí (nunca bloquea, mismo criterio que `pasaFiltroTerreno` sin dato).
