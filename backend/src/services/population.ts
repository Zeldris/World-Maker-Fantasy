import type { Prisma, PrismaClient, PopulationTargetType } from '@prisma/client';

/// Población dinámica (docs/16-poblacion-dinamica.md) — hasta 2026-08-03, `WorldPopulation` era
/// solo dato semilla (2026-07-29) sin ningún código de partida que lo leyera ni lo modificara. Esto
/// le da uso real: morir de verdad depleciona la fila que corresponda, y una tasa de crecimiento
/// diferenciada por tipo la repuebla con el tiempo — con un umbral mínimo bajo el cual una especie
/// no se recupera sola (extinción real y permanente es posible).

/// Umbral mínimo de reproducción (cifra explícita de la usuaria, 2026-08-02: "quiero que mientras
/// sea 4+ pueda reproducirse pero menos en menos de 4") — por debajo, muy pocos individuos para
/// encontrar pareja, la fila no crece este ciclo.
export const UMBRAL_MINIMO_REPRODUCCION = 4;

/// Tasas de partida, por día real transcurrido — no un cierre definitivo, fácilmente ajustables.
/// La fauna se reproduce categóricamente más rápido que las razas de NPC (petición explícita:
/// "lógicamente la fauna en general tiene más posibilidades de reproducirse que una raza de npc").
const GROWTH_RATE_PER_DAY: Record<PopulationTargetType, number> = {
  FAUNA: 0.02,
  RAZA: 0.003,
  // Recursos de recolección (rediseño de profesiones, 2026-08-07) — entre fauna (se reproduce) y
  // raza (crece muy despacio): una veta/matorral no se "reproduce", pero sí se repone con el
  // tiempo (vetas nuevas expuestas por erosión, rebrote de matorral) — cifra de partida, ajustable.
  RECURSO: 0.01,
  // FLORA/FACCION (2026-08-15, valores nuevos del enum, todavía sin ninguna fila sembrada) —
  // mismo criterio que RECURSO para flora (se repone con el tiempo, no "se reproduce") y que RAZA
  // para facciones (población militar/civil, crece muy despacio). Cifras de partida, ajustables
  // cuando haya datos reales que las usen.
  FLORA: 0.01,
  FACCION: 0.003,
};

/// Bug real jugando en vivo (2026-08-07, "no aparece ningún recurso en la Hondonada"): las claves
/// de `WorldPopulation.distribucion` (aquí y en `harvestSourceRegion`, worldCatalog.ts) se siembran
/// SIN artículo ("Llanuras del Viento Rojo"), pero `Location.region` SIEMPRE lo lleva completo
/// ("Las Llanuras del Viento Rojo") — igual que `ORC_REGION_SUFFIX` de abajo, que sí usa el
/// artículo completo a propósito (ver su comentario). Comparar `distribucion[location.region]`
/// directamente fallaba silenciosamente para cualquier región CON artículo (Llanuras/Margen/
/// Meseta — 3 de las 5 regiones reales) — "Cristal Helado"/"Ciénaga Troncal" no lo llevan, así que
/// ahí "funcionaba" por pura coincidencia, ocultando el bug. Afectaba a la vez a tres sitios
/// distintos: el pop-up de recolección nuevo (recolectar.ts), la ponderación de encuentros
/// ambientales (turnResolution.ts, desde 2026-08-03) y quién aparece al interrumpir un viaje
/// (travelInterruption.ts, desde 2026-08-05) — los dos últimos fallaban en silencio (una sugerencia
/// opcional que simplemente no salía nunca), nadie lo había notado hasta que el pop-up de
/// recolección lo hizo visible de golpe.
export function stripRegionArticle(region: string): string {
  return region.replace(/^(Las|La|El|Los)\s+/, '');
}

/// Sufijo de `targetSlug` para los 3 clanes orcos regionales (worldPopulation.ts) — biología
/// distinta entre ellos, no fluyen entre sí salvo guerra/evento de mundo (decisión ya cerrada).
/// Claves = `Location.region` tal cual se siembra en worldCatalog.ts (con artículo completo).
const ORC_REGION_SUFFIX: Record<string, string> = {
  'Las Llanuras del Viento Rojo': 'llanuras',
  'Cristal Helado': 'cristal-helado',
  'Ciénaga Troncal': 'cienaga',
};

/// Resuelve a qué fila de `WorldPopulation` corresponde un NPC (docs/16 § 3.1). `raza` null =
/// fauna (cada especie de worldCatalog.ts es ya 1 fila, keyed por su propio slug). `raza` no-null
/// = raza jugable: las de un solo territorio usan el slug de raza directo; los orcos necesitan la
/// región activa para desambiguar entre sus 3 clanes. `null` si no hay fila que corresponda (nunca
/// inventa una) — p.ej. un NPC sin raza que no es fauna de catálogo, o una región sin mapeo.
export function populationTargetSlugFor(raza: string | null, slug: string, region: string | null): string | null {
  if (!raza) return slug;
  if (raza === 'orcos') {
    const suffix = region ? ORC_REGION_SUFFIX[region] : undefined;
    return suffix ? `orcos-${suffix}` : null;
  }
  return raza;
}

type TxClient = Pick<PrismaClient, 'worldPopulation'> | Prisma.TransactionClient;

/// Resta 1 (sin bajar de 0) a la fila de población que corresponda a este NPC, dentro de la MISMA
/// transacción que resuelve el turno (docs/16 § 3.2) — llamado solo cuando un NPC pasa de verdad a
/// MUERTO (combate letal o Decapitar), nunca en CONVALECIENTE. No hace nada si no hay fila que
/// corresponda (mismo criterio de "no bloquear el turno si el dato no existe" que el resto del
/// motor).
export async function decrementPopulationOnDeath(
  tx: TxClient,
  worldId: string,
  raza: string | null,
  slug: string,
  region: string | null,
): Promise<void> {
  const targetType: PopulationTargetType = raza ? 'RAZA' : 'FAUNA';
  const targetSlug = populationTargetSlugFor(raza, slug, region);
  if (!targetSlug) return;

  // Bug real (auditoría 2026-08-06): antes esto era un `findUnique` + `update` con el valor de
  // `poblacion` capturado en memoria — sin ningún bloqueo, una muerte resuelta en un turno en vivo
  // y un tick de `growAllPopulations` (worldTick.ts) casi simultáneos sobre la MISMA fila podían
  // pisarse: el que escribe último sobrescribe con un número calculado sobre un `poblacion` ya
  // obsoleto, borrando en silencio la muerte o el crecimiento del otro. `updateMany` con
  // `{ decrement: 1 }` es atómico de verdad en Postgres — el guard `poblacion: { gt: 0 }` evita
  // que baje de 0 sin necesitar releer nada antes.
  await tx.worldPopulation.updateMany({
    where: { worldId, targetType, targetSlug, poblacion: { gt: 0 } },
    data: { poblacion: { decrement: 1 } },
  });
}

const MS_POR_DIA = 24 * 60 * 60_000;

/// Crecimiento prorrateado por tiempo real desde la última actualización de cada fila (docs/16
/// § 3.3), llamado desde el tick periódico de `worldTick.ts` — nunca desde el turno síncrono, ya
/// que `WorldPopulation` es del `World`, no de una `Save` concreta.
///
/// Solo se escribe la fila (y por tanto se avanza su `updatedAt`) cuando el crecimiento calculado
/// cruza al menos 1 individuo entero — si actualizáramos en cada tick aunque el delta fuera 0,
/// `updatedAt` se resetearía sin parar y el tiempo transcurrido nunca llegaría a acumularse lo
/// bastante para cruzar el siguiente entero. Dejar la fila intacta hace que seguir esperando en el
/// próximo tick sea exactamente igual de válido que esperar más entre ticks.
export async function growAllPopulations(prisma: Pick<PrismaClient, 'worldPopulation'>): Promise<{ updated: number }> {
  const rows = await prisma.worldPopulation.findMany();
  const now = Date.now();
  let updated = 0;

  for (const row of rows) {
    if (row.poblacion < UMBRAL_MINIMO_REPRODUCCION) continue;
    const elapsedDays = (now - row.updatedAt.getTime()) / MS_POR_DIA;
    if (elapsedDays <= 0) continue;
    const delta = Math.floor(row.poblacion * GROWTH_RATE_PER_DAY[row.targetType] * elapsedDays);
    if (delta < 1) continue;

    // Bug real (auditoría 2026-08-06, ver comentario de decrementPopulationOnDeath arriba): mismo
    // riesgo de carrera con una muerte resuelta en un turno en vivo justo entre este `findMany` y
    // este `update` — `{ increment: delta }` es atómico, no pisa lo que haya escrito el otro lado
    // mientras tanto (a diferencia de sumar `delta` a un `row.poblacion` ya capturado en memoria).
    await prisma.worldPopulation.update({
      where: { id: row.id },
      data: { poblacion: { increment: delta } },
    });
    updated++;
  }

  return { updated };
}
