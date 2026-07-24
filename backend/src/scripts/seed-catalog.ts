import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { locations, locationLinks, npcs, fauna, items, harvestYields } from './worldCatalog.js';

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
  for (const link of locationLinks) {
    const fromId = locationIdBySlug.get(link.fromSlug);
    const toId = locationIdBySlug.get(link.toSlug);
    if (!fromId || !toId) throw new Error(`Ruta con slug desconocido: ${link.fromSlug} <-> ${link.toSlug}`);
    await prisma.locationLink.upsert({
      where: { fromId_toId: { fromId, toId } },
      update: { minutosBase: link.minutosBase, terreno: link.terreno, riesgo: link.riesgo },
      create: { fromId, toId, minutosBase: link.minutosBase, terreno: link.terreno, riesgo: link.riesgo },
    });
  }

  console.log(`  Objetos de catálogo (${items.length})...`);
  const itemIdBySlug = new Map<string, string>();
  for (const item of items) {
    const row = await prisma.itemCatalog.upsert({
      where: { worldId_slug: { worldId, slug: item.slug } },
      update: {
        name: item.name,
        category: item.category,
        description: item.description,
        statBonusAttribute: item.statBonusAttribute ?? null,
        statBonusAmount: item.statBonusAmount ?? null,
        // dimensiones/lugarOrigen faltaban aquí (bug real preexistente, corregido de paso
        // 2026-07-23): un reseed nunca actualizaba estos campos en filas ya creadas, solo
        // `create` los recibía. tier/requisitos son nuevos, mismo criterio desde el principio.
        dimensiones: item.dimensiones ?? null,
        lugarOrigen: item.lugarOrigen ?? null,
        tier: item.tier ?? 1,
        requisitos: item.requisitos ?? Prisma.JsonNull,
      },
      create: { worldId, ...item },
    });
    itemIdBySlug.set(item.slug, row.id);
  }

  const allNpcs = [...npcs, ...fauna];
  console.log(`  NPCs (${allNpcs.length})...`);
  for (const npc of allNpcs) {
    const { loadout, ...npcData } = npc;
    const row = await prisma.npc.upsert({
      where: { worldId_slug: { worldId, slug: npc.slug } },
      update: {
        name: npcData.name,
        kind: npcData.kind,
        aliases: npcData.aliases,
        faction: npcData.faction,
        role: npcData.role,
        level: npcData.level,
        levelMax: npcData.levelMax,
        attributes: npcData.attributes,
        bio: npcData.bio,
        personality: npcData.personality,
        homeLocationSlug: npcData.homeLocationSlug,
      },
      create: { worldId, ...npcData },
    });

    for (const entry of loadout) {
      const itemId = itemIdBySlug.get(entry.itemSlug);
      if (!itemId) throw new Error(`NPC "${npc.slug}" lleva un objeto desconocido: ${entry.itemSlug}`);
      await prisma.npcItem.upsert({
        where: { npcId_itemId: { npcId: row.id, itemId } },
        update: { cantidad: entry.cantidad ?? 1, notas: entry.notas },
        create: { npcId: row.id, itemId, cantidad: entry.cantidad ?? 1, notas: entry.notas },
      });
    }
  }

  console.log(`  Recursos cosechables (${harvestYields.length})...`);
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
        itemId,
        cantidad: yieldRow.cantidad,
        condicion: yieldRow.condicion,
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

  console.log('Catálogo de mundo sembrado correctamente.');
}

main()
  .catch((err) => {
    console.error('Error sembrando el catálogo de mundo:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
