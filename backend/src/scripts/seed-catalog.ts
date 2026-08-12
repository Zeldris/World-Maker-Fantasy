import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { locations, locationLinks, npcs, fauna, items, harvestYields, factions, historiaEntries } from './worldCatalog.js';
import { assertValidCategory } from '../services/itemTaxonomy.js';
import { worldPopulations } from './worldPopulation.js';

/// Siembra el catálogo de mundo estructurado (docs/12-mundo-estructurado.md): ubicaciones,
/// rutas, NPCs, armería y recursos cosechables de las Llanuras del Viento Rojo. Idempotente
/// (upsert por las claves @@unique de cada modelo) — correr de nuevo tras editar worldCatalog.ts.
/// Uso: npm run seed-catalog

const WORLD_SLUG = 'helek-sirik';

async function main() {
  const world = await prisma.world.findUnique({ where: { slug: WORLD_SLUG } });
  if (!world) {
    throw new Error(`No existe el mundo "${WORLD_SLUG}" — correr antes npm run reindex-lore.`);
  }
  const worldId = world.id;

  console.log(`Sembrando catálogo para el mundo "${world.name}"...`);

  console.log(`  Ubicaciones (${locations.length})...`);
  const locationIdBySlug = new Map<string, string>();
  for (const loc of locations) {
    const row = await prisma.location.upsert({
      where: { worldId_slug: { worldId, slug: loc.slug } },
      update: { name: loc.name, region: loc.region, kind: loc.kind, description: loc.description, aliases: loc.aliases },
      create: { worldId, ...loc },
    });
    locationIdBySlug.set(loc.slug, row.id);
  }

  console.log(`  Rutas (${locationLinks.length})...`);
  // Bug real (2026-08-05, encontrado jugando: "la desembocadura callada conecta con los restos de
  // maktor" — una arista que ya no existía en `locationLinks` seguía viva en la DB): el upsert de
  // abajo crea/actualiza, pero nunca borraba las aristas que se quitan de `worldCatalog.ts` al
  // reestructurar rutas — se quedaban fantasma para siempre. Mismo patrón que `harvestYield` más
  // abajo: se borra todo lo del mundo y se recrea entero, más simple y seguro que diferenciar caso
  // a caso qué arista sigue viva.
  await prisma.locationLink.deleteMany({ where: { from: { worldId } } });
  for (const link of locationLinks) {
    const fromId = locationIdBySlug.get(link.fromSlug);
    const toId = locationIdBySlug.get(link.toSlug);
    if (!fromId || !toId) throw new Error(`Ruta con slug desconocido: ${link.fromSlug} <-> ${link.toSlug}`);
    await prisma.locationLink.create({
      data: { fromId, toId, minutosBase: link.minutosBase, terreno: link.terreno, riesgo: link.riesgo },
    });
  }

  console.log(`  Objetos de catálogo (${items.length})...`);
  const itemIdBySlug = new Map<string, string>();
  for (const item of items) {
    // Categorización mecánica (2026-07-29) — falla rápido ante un typo de categoría o una
    // combinación tipo/categoría que no tiene sentido, antes de escribir nada en BD.
    assertValidCategory(item.tipo, item.category, item.slug);
    const row = await prisma.itemCatalog.upsert({
      where: { worldId_slug: { worldId, slug: item.slug } },
      update: {
        name: item.name,
        aliases: item.aliases ?? [],
        equipSlot: item.equipSlot ?? null,
        category: item.category,
        tipo: item.tipo,
        description: item.description,
        statBonuses: item.statBonuses ?? Prisma.JsonNull,
        // dimensiones/lugarOrigen faltaban aquí (bug real preexistente, corregido de paso
        // 2026-07-23): un reseed nunca actualizaba estos campos en filas ya creadas, solo
        // `create` los recibía. tier/requisitos son nuevos, mismo criterio desde el principio.
        dimensiones: item.dimensiones ?? null,
        lugarOrigen: item.lugarOrigen ?? null,
        tier: item.tier ?? 1,
        requisitos: item.requisitos ?? Prisma.JsonNull,
        curaHasta: item.curaHasta ?? null,
        curaUnPaso: item.curaUnPaso ?? false,
        tipoArma: item.tipoArma ?? null,
        curaEnergia: item.curaEnergia ?? null,
        effectKey: item.effectKey ?? null,
        effectDescription: item.effectDescription ?? null,
      },
      create: { worldId, ...item },
    });
    itemIdBySlug.set(item.slug, row.id);
  }

  console.log(`  Facciones (${factions.length})...`);
  const factionNameSet = new Set(factions.map((f) => f.name));
  for (const faction of factions) {
    await prisma.faction.upsert({
      where: { worldId_slug: { worldId, slug: faction.slug } },
      update: { name: faction.name, raza: faction.raza, description: faction.description },
      create: { worldId, ...faction },
    });
  }
  // Fail-fast (2026-08-06): cada Npc.faction no-null usado en worldCatalog.ts debe tener una
  // Faction homónima exacta — si no, el enganche de descubrimiento en cascada
  // (entityDiscovery.ts) nunca dispararía para ese NPC, en silencio.
  for (const npc of [...npcs, ...fauna]) {
    if (npc.faction && !factionNameSet.has(npc.faction)) {
      throw new Error(`NPC "${npc.slug}" tiene faction "${npc.faction}" sin ninguna Faction homónima en el catálogo de facciones.`);
    }
  }

  const allNpcs = [...npcs, ...fauna];
  console.log(`  NPCs (${allNpcs.length})...`);
  for (const npc of allNpcs) {
    const { loadout, habilidadesRaciales, ...npcData } = npc;
    // Rediseño de la vista de combate (2026-07-28): `habilidadesRaciales` se castea a mano — un
    // array de una interfaz con propiedades nombradas (sin índice de firma `string`) no satisface
    // el `InputJsonValue` de Prisma por estructura, aunque el dato en sí sea JSON válido.
    const habilidadesRacialesJson = (habilidadesRaciales ?? []) as unknown as Prisma.InputJsonValue;
    const row = await prisma.npc.upsert({
      where: { worldId_slug: { worldId, slug: npc.slug } },
      update: {
        name: npcData.name,
        kind: npcData.kind,
        aliases: npcData.aliases,
        faction: npcData.faction,
        role: npcData.role,
        articulo: npcData.articulo ?? null,
        genero: npcData.genero ?? null,
        level: npcData.level,
        levelMax: npcData.levelMax,
        attributes: npcData.attributes,
        bio: npcData.bio,
        personality: npcData.personality,
        homeLocationSlug: npcData.homeLocationSlug,
        raza: npcData.raza,
        clase: npcData.clase,
        ataqueNatural: npcData.ataqueNatural,
        habilidadesRaciales: habilidadesRacialesJson,
        temperamento: npcData.temperamento,
        comerciablePct: npcData.comerciablePct,
        reclutablePct: npcData.reclutablePct,
        domesticablePct: npcData.domesticablePct,
        capturablePct: npcData.capturablePct,
        cortejablePct: npcData.cortejablePct,
      },
      create: { worldId, ...npcData, habilidadesRaciales: habilidadesRacialesJson },
    });

    const loadoutItemIds = loadout.map((entry) => {
      const itemId = itemIdBySlug.get(entry.itemSlug);
      if (!itemId) throw new Error(`NPC "${npc.slug}" lleva un objeto desconocido: ${entry.itemSlug}`);
      return itemId;
    });
    // Mismo bug que ya se arregló para locationLink (2026-08-03): un upsert por entrada nunca
    // borra lo que se QUITÓ del loadout en worldCatalog.ts — un objeto retirado del código se
    // quedaba vivo en la DB para siempre (bug real, 2026-08-13: "Mapa de las Llanuras" seguía
    // saqueable del Orco Enfurecido tras quitarlo del loadout, porque ya estaba seedado).
    await prisma.npcItem.deleteMany({ where: { npcId: row.id, itemId: { notIn: loadoutItemIds } } });
    for (const entry of loadout) {
      const itemId = itemIdBySlug.get(entry.itemSlug)!;
      await prisma.npcItem.upsert({
        where: { npcId_itemId: { npcId: row.id, itemId } },
        update: { cantidad: entry.cantidad ?? 1, notas: entry.notas },
        create: { npcId: row.id, itemId, cantidad: entry.cantidad ?? 1, notas: entry.notas },
      });
    }
  }

  console.log(`  Entradas de Historia (${historiaEntries.length})...`);
  const allNpcSlugsForHistoria = new Set(allNpcs.map((n) => n.slug));
  for (const entry of historiaEntries) {
    if (!itemIdBySlug.has(entry.documentoItemSlug)) {
      throw new Error(`HistoriaEntry "${entry.slug}" referencia un objeto desconocido: ${entry.documentoItemSlug}`);
    }
    if (entry.translatorNpcSlug && !allNpcSlugsForHistoria.has(entry.translatorNpcSlug)) {
      throw new Error(`HistoriaEntry "${entry.slug}" referencia un NPC traductor desconocido: ${entry.translatorNpcSlug}`);
    }
    if (entry.requiresTranslation && !entry.translatorNpcSlug) {
      throw new Error(`HistoriaEntry "${entry.slug}" tiene requiresTranslation=true pero no translatorNpcSlug.`);
    }
    await prisma.historiaEntry.upsert({
      where: { worldId_slug: { worldId, slug: entry.slug } },
      update: {
        title: entry.title,
        era: entry.era,
        year: entry.year,
        text: entry.text,
        requiresTranslation: entry.requiresTranslation ?? false,
        documentoItemSlug: entry.documentoItemSlug,
        translatorNpcSlug: entry.translatorNpcSlug ?? null,
      },
      create: {
        worldId,
        slug: entry.slug,
        title: entry.title,
        era: entry.era,
        year: entry.year,
        text: entry.text,
        requiresTranslation: entry.requiresTranslation ?? false,
        documentoItemSlug: entry.documentoItemSlug,
        translatorNpcSlug: entry.translatorNpcSlug ?? null,
      },
    });
  }

  console.log(`  Recursos cosechables (${harvestYields.length})...`);
  // Invariante (2026-07-29): todas las filas de un mismo sourceSlug deben exigir el mismo verbo
  // — harvest.ts asume esto (mira solo la primera fila para decidir qué regex aplicar). Falla
  // rápido aquí en vez de dejar un dato inconsistente silencioso.
  const metodoBySource = new Map<string, string>();
  for (const yieldRow of harvestYields) {
    const previo = metodoBySource.get(yieldRow.sourceSlug);
    if (previo && previo !== yieldRow.metodoObtencion) {
      throw new Error(
        `HarvestYield "${yieldRow.sourceSlug}" tiene metodoObtencion inconsistente entre filas: "${previo}" vs "${yieldRow.metodoObtencion}"`,
      );
    }
    metodoBySource.set(yieldRow.sourceSlug, yieldRow.metodoObtencion);
  }

  // Sin @@unique compuesto propio en HarvestYield (varias filas comparten sourceSlug) —
  // se borra y recrea todo lo del mundo, igual de simple que reindex-lore con este tamaño.
  await prisma.harvestYield.deleteMany({ where: { worldId } });
  for (const yieldRow of harvestYields) {
    const itemId = itemIdBySlug.get(yieldRow.itemSlug);
    if (!itemId) throw new Error(`HarvestYield con objeto desconocido: ${yieldRow.itemSlug}`);
    await prisma.harvestYield.create({
      data: {
        worldId,
        sourceSlug: yieldRow.sourceSlug,
        sourceName: yieldRow.sourceName,
        metodoObtencion: yieldRow.metodoObtencion,
        itemId,
        cantidad: yieldRow.cantidad,
        condicion: yieldRow.condicion,
      },
    });
  }

  console.log(`  Población del mundo (${worldPopulations.length})...`);
  // Upsert real (no borrar+recrear como HarvestYield): `poblacion` es mutable de cara al futuro
  // (nacimientos/muertes/migraciones simuladas más adelante) — un reseed nunca debería resetear
  // el valor actual a la semilla si ya se ha ido moviendo, solo crear lo que falte.
  //
  // Bug real (auditoría 2026-08-06): el `update` se dejó VACÍO del todo para proteger solo
  // `poblacion` — pero eso también bloqueaba cualquier corrección futura de `label`/`poblacionMax`/
  // `distribucion` en una fila ya sembrada (precedente real: worldPopulation.ts ya corrigió una
  // vez el label de "Maktor/Serhu" a "Clan Serhu", corrección que un reseed sobre un mundo ya
  // sembrado nunca habría aplicado). `distribucion` en concreto no es solo cosmético: lo lee
  // travelInterruption.ts para ponderar encuentros ambientales por región.
  for (const pop of worldPopulations) {
    await prisma.worldPopulation.upsert({
      where: { worldId_targetType_targetSlug: { worldId, targetType: pop.targetType, targetSlug: pop.targetSlug } },
      update: { label: pop.label, poblacionMax: pop.poblacionMax, distribucion: pop.distribucion },
      create: {
        worldId,
        targetType: pop.targetType,
        targetSlug: pop.targetSlug,
        label: pop.label,
        poblacion: pop.poblacion,
        poblacionMax: pop.poblacionMax,
        distribucion: pop.distribucion,
      },
    });
  }

  console.log('  Backfill de partidas existentes de Gorhorn sin posición...');
  const hondonadaId = locationIdBySlug.get('hondonada-del-eco')!;
  const backfilled = await prisma.save.updateMany({
    where: { worldId, characterName: 'Gorhorn', currentLocationId: null },
    data: { currentLocationId: hondonadaId },
  });
  console.log(`    ${backfilled.count} partida(s) actualizada(s) a La Hondonada del Eco.`);

  // Backfill de InventoryItem huérfanas (2026-08-13, bugs reales jugando en vivo: "las
  // estadísticas del inventario inicial no salen" + "el efecto del mapa no funciona y sale como
  // objeto sin categorizar, equipable en cualquier ranura") — dos rutas de creación de
  // InventoryItem (startingInventory.ts, grantQuestRewardItems en questResolution.ts) no copiaban
  // `catalogSlug`/`statBonuses` desde ItemCatalog antes de este fix; las filas ya creadas en
  // partidas EN CURSO se quedaron así para siempre, sin volver a pasar por ese código. Solo toca
  // filas cuyo nombre coincide EXACTO con un objeto de catálogo real, nunca uno inventado por el
  // modelo (`newItem` sin ficha real detrás) — mismo criterio de "solo lo que existe de verdad"
  // que el resto del motor.
  console.log('  Backfill de InventoryItem sin catalogSlug/statBonuses...');
  const catalogRowsForBackfill = await prisma.itemCatalog.findMany({ where: { worldId }, select: { slug: true, name: true, statBonuses: true } });
  const catalogByName = new Map(catalogRowsForBackfill.map((c) => [c.name, c]));
  const catalogBySlug = new Map(catalogRowsForBackfill.map((c) => [c.slug, c]));
  const existingItems = await prisma.inventoryItem.findMany({
    where: { save: { worldId } },
    select: { id: true, name: true, catalogSlug: true, statBonuses: true },
  });
  let backfilledItems = 0;
  for (const item of existingItems) {
    const catalog = item.catalogSlug ? catalogBySlug.get(item.catalogSlug) : catalogByName.get(item.name);
    if (!catalog) continue;
    const needsCatalogSlug = !item.catalogSlug;
    const needsStatBonuses = item.statBonuses === null && catalog.statBonuses !== null;
    if (!needsCatalogSlug && !needsStatBonuses) continue;
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        ...(needsCatalogSlug ? { catalogSlug: catalog.slug } : {}),
        ...(needsStatBonuses ? { statBonuses: catalog.statBonuses ?? Prisma.JsonNull } : {}),
      },
    });
    backfilledItems++;
  }
  console.log(`    ${backfilledItems} objeto(s) de inventario actualizado(s).`);

  console.log('Catálogo de mundo sembrado correctamente.');
}

main()
  .catch((err) => {
    console.error('Error sembrando el catálogo de mundo:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
