import type { Prisma, PrismaClient, PopulationTargetType } from '@prisma/client';
import { avanzarCaza } from './cronista/misionesJugadora.js';
import { ambitoPoblacion } from './mundoPartida.js';

/// Población dinámica (docs/mecanicas/16-poblacion-dinamica.md) — hasta 2026-08-03, `WorldPopulation` era
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
  // FLORA (2026-08-15) — mismo criterio que RECURSO: se repone con el tiempo, no "se reproduce".
  FLORA: 0.01,
  // FACCION (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.6, 2026-09-21, primeras filas reales sembradas
  // — antes solo la tasa existía, "todavía sin ninguna fila sembrada") — mismo ritmo que RAZA
  // (crece muy despacio, coherente con ser un subconjunto YA organizado de esa misma raza).
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

type TxClient = PrismaClient | Prisma.TransactionClient;

/// Resta 1 (sin bajar de 0) a la fila de población que corresponda a este NPC, dentro de la MISMA
/// transacción que resuelve el turno (docs/16 § 3.2) — llamado solo cuando un NPC pasa de verdad a
/// MUERTO (combate letal o Decapitar), nunca en CONVALECIENTE. No hace nada si no hay fila que
/// corresponda (mismo criterio de "no bloquear el turno si el dato no existe" que el resto del
/// motor).
export async function decrementPopulationOnDeath(
  tx: TxClient,
  /// CR-6 (hito 0.2): la partida; resta en su población (roadmap-cronista.md § 5.3).
  saveId: string,
  raza: string | null,
  slug: string,
  region: string | null,
): Promise<void> {
  const targetType: PopulationTargetType = raza ? 'RAZA' : 'FAUNA';
  const targetSlug = populationTargetSlugFor(raza, slug, region);
  if (!targetSlug) return;

  // Bug real (auditoría 2026-08-06): antes esto era un `findUnique` + `update` con el valor de
  // `poblacion` capturado en memoria — sin ningún bloqueo, una muerte resuelta en un turno en vivo
  // y un crecimiento diario (`crecerPoblacionDePartida`) casi simultáneos sobre la MISMA fila podían
  // pisarse: el que escribe último sobrescribe con un número calculado sobre un `poblacion` ya
  // obsoleto, borrando en silencio la muerte o el crecimiento del otro. `updateMany` con
  // `{ decrement: 1 }` es atómico de verdad en Postgres — el guard `poblacion: { gt: 0 }` evita
  // que baje de 0 sin necesitar releer nada antes.
  const ambito = await ambitoPoblacion(tx, saveId);
  await tx.worldPopulation.updateMany({
    where: { ...ambito, targetType, targetSlug, poblacion: { gt: 0 } },
    data: { poblacion: { decrement: 1 } },
  });
  // CR-40 (40e): una pieza más para las misiones de cazar esa especie.
  if (targetType === 'FAUNA') await avanzarCaza(tx, saveId, targetSlug, region);
}

/// CR-7 (hito 0.2): crecimiento de una fila en `dias` días de ficción — compuesto a la tasa de su
/// tipo, con umbral mínimo de reproducción y techo (`poblacionMax`). La parte fraccionaria se gana con esa
/// probabilidad (sin ella, una población pequeña de crecimiento lento nunca sumaría un individuo en
/// un solo día). Puro salvo por `random`.
export function crecimientoEnDias(
  poblacion: number,
  poblacionMax: number,
  tipo: PopulationTargetType,
  dias: number,
  random: () => number = Math.random,
): number {
  if (dias <= 0 || poblacion < UMBRAL_MINIMO_REPRODUCCION) return 0;
  const esperado = poblacion * ((1 + GROWTH_RATE_PER_DAY[tipo]) ** dias - 1);
  const entero = Math.floor(esperado);
  const delta = entero + (random() < esperado - entero ? 1 : 0);
  return Math.min(delta, Math.max(0, poblacionMax - poblacion));
}

/// CR-7 (hito 0.2): hace crecer `dias` días de ficción la población de una partida. Devuelve
/// cuántas filas cambiaron.
export async function crecerPoblacionDePartida(
  tx: Pick<PrismaClient, 'worldPopulation'> | Prisma.TransactionClient,
  saveId: string,
  dias: number,
  random: () => number = Math.random,
): Promise<number> {
  if (dias <= 0) return 0;
  const filas = await tx.worldPopulation.findMany({
    where: { saveId, poblacion: { gte: UMBRAL_MINIMO_REPRODUCCION } },
    select: { id: true, poblacion: true, poblacionMax: true, targetType: true },
  });
  let cambiadas = 0;
  for (const fila of filas) {
    const delta = crecimientoEnDias(fila.poblacion, fila.poblacionMax, fila.targetType, dias, random);
    if (delta < 1) continue;
    await tx.worldPopulation.update({ where: { id: fila.id }, data: { poblacion: { increment: delta } } });
    cambiadas++;
  }
  return cambiadas;
}

/// Sincroniza `WorldPopulation` (targetType FACCION) → `KingdomStats` de cada `Faction` de
/// catálogo (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.6, 2026-09-21) — el "reino" de una facción ya
/// generalizado en § 4.2 necesita reflejar el crecimiento real de la población para que
/// tenga efecto observable (antes de esto, la tasa `FACCION` existía pero no escribía en ningún
/// sitio que el resto del motor leyera). 4 filas por facción, `targetSlug` = `<faction.slug>-
/// poblacion`/`-soldados`/`-trabajadores`/`-visitantes` (ver worldPopulation.ts) — cada una
/// alimenta el campo homónimo de `KingdomStats`, mismos 4 conceptos ya usados por el reino del
/// jugador (`tickKingdomOneDay`). Llamada desde el avance diario de la partida (`avanceDiario.ts`),
/// tras hacer crecer su población.
export async function syncFactionPopulationToKingdomStats(
  prisma: Pick<PrismaClient, 'worldPopulation' | 'faction' | 'kingdomStats'> | Prisma.TransactionClient,
  /// CR-7 (hito 0.2): `{ saveId }` para una partida (desde `avanceDiario.ts`); el tick del mundo
  /// pasa `{ saveId: null }` (catálogo).
  filtro: Prisma.WorldPopulationWhereInput = {},
): Promise<{ synced: number }> {
  const rows = await prisma.worldPopulation.findMany({ where: { ...filtro, targetType: 'FACCION' } });
  if (rows.length === 0) return { synced: 0 };

  // CR-6 (hito 0.2): agrupado por partida y facción — las filas de una partida van a la copia de la
  // facción de esa partida; las del mundo (saveId null), a la facción de catálogo.
  const byFactionSlug = new Map<string, { saveId: string | null; slug: string; poblacion?: number; soldados?: number; trabajadores?: number; visitantes?: number }>();
  const CAMPOS = ['poblacion', 'soldados', 'trabajadores', 'visitantes'] as const;
  for (const row of rows) {
    const campo = CAMPOS.find((c) => row.targetSlug.endsWith(`-${c}`));
    if (!campo) continue; // fila FACCION con targetSlug que no sigue el patrón — se ignora, no inventa nada
    const factionSlug = row.targetSlug.slice(0, -(campo.length + 1));
    const clave = `${row.saveId ?? ''}|${factionSlug}`;
    const entry = byFactionSlug.get(clave) ?? { saveId: row.saveId ?? null, slug: factionSlug };
    entry[campo] = row.poblacion;
    byFactionSlug.set(clave, entry);
  }

  let synced = 0;
  for (const campos of byFactionSlug.values()) {
    const faction = await prisma.faction.findFirst({ where: { slug: campos.slug, saveId: campos.saveId }, select: { id: true } });
    if (!faction) continue; // catálogo desalineado (fila sembrada sin su Faction) — no bloquea el resto
    const kingdomStats = await prisma.kingdomStats.findFirst({ where: { factionId: faction.id }, select: { id: true } });
    if (!kingdomStats) continue; // sin KingdomStats todavía (facción sin reino fundado) — nada que sincronizar
    await prisma.kingdomStats.update({
      where: { id: kingdomStats.id },
      data: {
        // CR-54 (Q16): comen todos — la población que come son civiles y trabajadores.
        poblacion: campos.poblacion === undefined ? undefined : campos.poblacion + (campos.trabajadores ?? 0),
        soldados: campos.soldados,
        trabajadores: campos.trabajadores,
        visitantes: campos.visitantes,
      },
    });
    synced++;
  }

  return { synced };
}
