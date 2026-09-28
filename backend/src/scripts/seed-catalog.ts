import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { locations, locationLinks, npcs, fauna, items, harvestYields, factions, historiaEntries, zonePoints, factionBuildings } from './worldCatalog.js';
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
      update: { name: loc.name, region: loc.region, kind: loc.kind, description: loc.description, aliases: loc.aliases, x: loc.x, y: loc.y, teaser: loc.teaser ?? null },
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
        pesoArmadura: item.pesoArmadura ?? null,
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
        curaHambre: item.curaHambre ?? null,
        curaAgua: item.curaAgua ?? null,
        emptyContainerCatalogSlug: item.emptyContainerCatalogSlug ?? null,
        effectKey: item.effectKey ?? null,
        effectDescription: item.effectDescription ?? null,
        herramientaParaOficio: item.herramientaParaOficio ?? [],
        valorGoirnos: item.valorGoirnos,
      },
      create: { worldId, ...item },
    });
    itemIdBySlug.set(item.slug, row.id);
  }
  // B14 (pruebas 2026-09-28, origen del bug A1 "mena-de-hierro"): el upsert nunca borraba objetos
  // retirados del catálogo, así que una BD local podía conservar filas fantasma que el resto del
  // motor seguía encontrando. Se podan las del mundo que ya no están en `items` — sus únicas
  // referencias por FK (`NpcItem`, `HarvestYield`) son catálogo que este mismo script resiembra
  // (cascade); `InventoryItem` solo guarda `catalogSlug` como texto y conserva su nombre/datos.
  const retirados = await prisma.itemCatalog.deleteMany({ where: { worldId, slug: { notIn: items.map((i) => i.slug) } } });
  if (retirados.count > 0) console.log(`  Objetos retirados del catálogo: ${retirados.count}`);

  console.log(`  Facciones (${factions.length})...`);
  const factionNameSet = new Set(factions.map((f) => f.name));
  const factionIdByName = new Map<string, string>();
  for (const faction of factions) {
    const row = await prisma.faction.upsert({
      where: { worldId_slug: { worldId, slug: faction.slug } },
      update: { name: faction.name, raza: faction.raza, description: faction.description },
      create: { worldId, ...faction },
    });
    factionIdByName.set(faction.name, row.id);
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
  const npcIdBySlug = new Map<string, string>();
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
        teachesProfession: npcData.teachesProfession ?? null,
        raza: npcData.raza,
        clase: npcData.clase,
        especializacion: npcData.especializacion,
        // Sistema de categorías de raza de fauna (2026-09-02) — explícito en el update, igual que
        // el resto de campos opcionales de este bloque (no depender del spread del `create`).
        faunaCategoria: npcData.faunaCategoria ?? null,
        ataqueNatural: npcData.ataqueNatural,
        habilidadesRaciales: habilidadesRacialesJson,
        temperamento: npcData.temperamento,
        medio: npcData.medio,
        comerciablePct: npcData.comerciablePct,
        reclutablePct: npcData.reclutablePct,
        domesticablePct: npcData.domesticablePct,
        capturablePct: npcData.capturablePct,
        cortejablePct: npcData.cortejablePct,
        atributoResistencia: npcData.atributoResistencia,
        // Auditoría 2026-08-14 — ver comentario del campo en schema.prisma. Explícito en cada
        // reseed (no depender del default de columna, que solo aplica en `create`) para que
        // quitar la marca `false` de un NPC en worldCatalog.ts también se refleje al resembrar.
        nucleoJugable: npcData.nucleoJugable ?? true,
        // Menú contextual de interacción (2026-09-06) — mismo criterio que `nucleoJugable`:
        // explícito en el `update` para que quitar un tipo en worldCatalog.ts también se refleje.
        interactionTypes: npcData.interactionTypes ?? [],
        // Compañero de fauna con nombre propio (auditoría de lore 2026-09-13, C10) — mismo
        // criterio que arriba: explícito en el `update` para que quitar el vínculo en
        // worldCatalog.ts también se refleje al resembrar.
        companionOfNpcSlug: npcData.companionOfNpcSlug ?? null,
      },
      create: { worldId, ...npcData, nucleoJugable: npcData.nucleoJugable ?? true, habilidadesRaciales: habilidadesRacialesJson },
    });
    npcIdBySlug.set(npc.slug, row.id);

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

  // Faction.liderNpcId (docs/rpgtarkor/mundo-vivo-x4.md § 4.3, 2026-09-21) — el líder de GOBIERNO
  // (Terk'ikar/equivalente, decisión explícita de la autora, no el de guerra) de cada facción con
  // NPC real sembrado. Va DESPUÉS del bucle de NPCs (necesita `npcIdBySlug` ya poblado). Facciones
  // sin líder real todavía (ninguna hoy) simplemente no aparecen en este mapa — se quedan `null`.
  console.log('  Líderes de facción (Faction.liderNpcId)...');
  const FACTION_LEADER_SLUG: Record<string, string> = {
    'clan-serhu': 'ulkha-ketg',
    'clan-helsig': 'brenka',
    'clan-goshg': 'doshka',
    // Tanda OpenCode 2026-09-27/28 (A-01/A-37): Yovenne Tal pasa de líder de la Concordia a líder
    // de Los del Obelisco, la facción moderada a la que de verdad pertenece según historia.md — la
    // Concordia pasa a liderarla el Primer Censor Tarsen Vold, de la facción radical.
    'concordia-de-hierro': 'tarsen-vold',
    'los-del-obelisco': 'yovenne-tal',
    // A-02/A-04: Keseg Sael no tiene cargo de mando propio (los Nabieus no se gobiernan salvo por
    // cónclave); Aven Tessk es su portavoz, no un líder de gobierno, pero es la única ficha real de
    // la que el motor de disputas puede leer Inteligencia. Feg Tusha/Feg Ger: el Jakut no es un
    // cargo (A-06) — el liderNpcId es quien más a menudo está sentado en él.
    'keseg-sael': 'aven-tessk',
    'keseg-prisilke': 'ilka-dren',
    'feg-tusha': 'hulki',
    'feg-ger': 'yeru',
  };
  for (const [factionSlug, leaderSlug] of Object.entries(FACTION_LEADER_SLUG)) {
    const leaderNpcId = npcIdBySlug.get(leaderSlug);
    if (!leaderNpcId) throw new Error(`Faction "${factionSlug}" referencia un líder desconocido: ${leaderSlug}`);
    await prisma.faction.update({
      where: { worldId_slug: { worldId, slug: factionSlug } },
      data: { liderNpcId: leaderNpcId },
    });
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
        sourceCategory: yieldRow.sourceCategory,
        metodoObtencion: yieldRow.metodoObtencion,
        itemId,
        cantidad: yieldRow.cantidad,
        condicion: yieldRow.condicion,
        sinTirada: yieldRow.sinTirada ?? false,
        requiereHerramienta: yieldRow.requiereHerramienta ?? false,
        estacionRequerida: yieldRow.estacionRequerida ?? null,
        climaRequerido: yieldRow.climaRequerido ?? null,
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

  // KingdomStats inicial de facción (docs/rpgtarkor/mundo-vivo-x4.md § 4.6, 2026-09-21) — sin
  // esto, el reino generalizado en § 4.2 no tiene dónde aterrizar para NINGUNA Faction NPC (solo
  // el jugador, al fundar el suyo). Se siembra a partir de las MISMAS filas WorldPopulation
  // FACCION recién insertadas arriba, para no duplicar los números en dos sitios — ownerKey
  // (mismo criterio que reinoOwner.ts) es `faction:<id>`, nunca `save:<id>` aquí.
  console.log('  KingdomStats inicial de facción...');
  const factionPopulationRows = worldPopulations.filter((p) => p.targetType === 'FACCION');
  const factionSlugsWithPopulation = new Set(factionPopulationRows.map((p) => p.targetSlug.replace(/-(poblacion|soldados|trabajadores|visitantes)$/, '')));
  for (const factionSlug of factionSlugsWithPopulation) {
    const factionId = factionIdByName.get(factions.find((f) => f.slug === factionSlug)?.name ?? '');
    if (!factionId) continue; // catálogo desalineado — no bloquea el resto del seed
    const campoFor = (sufijo: string) => factionPopulationRows.find((p) => p.targetSlug === `${factionSlug}-${sufijo}`)?.poblacion ?? 0;
    await prisma.kingdomStats.upsert({
      where: { ownerKey: `faction:${factionId}` },
      update: {},
      create: {
        factionId,
        ownerKey: `faction:${factionId}`,
        poblacion: campoFor('poblacion'),
        soldados: campoFor('soldados'),
        trabajadores: campoFor('trabajadores'),
        visitantes: campoFor('visitantes'),
      },
    });
  }

  console.log(`  Puntos de zona (${zonePoints.length}, Grupo 3 § Mundo determinista, prototipo)...`);
  // Borrar+recrear por Location (mismo criterio que locationLink arriba) — más simple y seguro que
  // diferenciar caso a caso qué punto sigue vivo tras editar worldCatalog.ts.
  const zonePointLocationIds = [...new Set(zonePoints.map((p) => p.locationSlug))].map((slug) => locationIdBySlug.get(slug)!);
  await prisma.zonePoint.deleteMany({ where: { locationId: { in: zonePointLocationIds } } });
  for (const point of zonePoints) {
    const locationId = locationIdBySlug.get(point.locationSlug);
    if (!locationId) throw new Error(`ZonePoint con locationSlug desconocido: ${point.locationSlug}`);
    await prisma.zonePoint.create({
      data: { locationId, x: point.x, y: point.y, tipo: point.tipo, targetSlug: point.targetSlug, label: point.label ?? null, plantillaEspecifica: point.plantillaEspecifica ?? null },
    });
  }

  // Edificios de facción (ex-FactionBuilding, retirado 2026-09-21 — ver
  // docs/rpgtarkor/mundo-vivo-x4.md § 4.2): ahora se siembran como `Building.factionId` en vez de
  // en su propio modelo, mismo motor que usa el jugador. `recipeKey` guarda el `slug` de catálogo
  // (idempotencia vía `@@unique([factionId, recipeKey])`); `saveId` queda null a propósito (no es
  // reino del jugador). `factionSlug`/`locationSlug` de worldCatalog.ts son en realidad NAME/slug
  // libres (mismo criterio laxo que `Npc.faction`) — se resuelven aquí a id real.
  console.log(`  Edificios de facción (${factionBuildings.length}, "Trabajador de Reino")...`);
  for (const building of factionBuildings) {
    const factionId = factionIdByName.get(building.factionSlug);
    if (!factionId) throw new Error(`FactionBuilding "${building.slug}" referencia una facción desconocida: ${building.factionSlug}`);
    const locationId = locationIdBySlug.get(building.locationSlug);
    if (!locationId) throw new Error(`FactionBuilding "${building.slug}" referencia una Location desconocida: ${building.locationSlug}`);
    await prisma.building.upsert({
      where: { factionId_recipeKey: { factionId, recipeKey: building.slug } },
      update: {
        name: building.name,
        locationId,
        kind: building.profession ?? 'sede',
        status: 'ACTIVO',
        description: building.description,
        tier: building.tier,
      },
      create: {
        factionId,
        locationId,
        recipeKey: building.slug,
        name: building.name,
        kind: building.profession ?? 'sede',
        status: 'ACTIVO',
        description: building.description,
        tier: building.tier,
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
