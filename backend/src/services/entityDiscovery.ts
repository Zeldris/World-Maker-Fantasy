import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { normalizeText, matchesAliasBoundary } from './travel.js';
import { harvestSourceAliases } from '../scripts/worldCatalog.js';

/// Enciclopedia progresiva (sesión de diseño 2026-07-23, petición explícita de la usuaria: "en vez
/// de tener todo descubierto desde el inicio... los npcs, fauna, flora, etc... solo se verá una
/// vez la AI lo mencione por primera vez en la narración, o sean objetos que ya tenemos"). Se
/// llama al final de cada turno persistido (turnResolution.ts) — escanea la narración + los
/// `new_facts` de ESTE turno (no hace falta releer todo el historial: `DiscoveredEntity` ya
/// acumula lo de turnos anteriores) en busca de nombres/aliases reales de catálogo, y añade
/// también lo que el jugador ya lleva en el inventario (puede llevar un objeto sin que la
/// narración de este turno lo haya nombrado, p.ej. el equipo inicial). Nunca lanza: un fallo aquí
/// no debe tirar abajo el turno que ya se narró y persistió correctamente.
///
/// Nombrado `entityDiscovery` (no `discovery`, ya ocupado por el "revelado progresivo" de
/// hallazgos de búsqueda/recolección en combate — services/discovery.ts, concepto distinto).
export async function recordEntityDiscoveries(
  params: { saveId: string; worldId: string; mentionedText: string },
  // Cliente opcional de transacción (auditoría 2026-07-28, fix #9): al crear/reiniciar partida se
  // pasa el `tx` de la transacción que ya está creando el Save, para que un crash a mitad de
  // proceso no deje la partida jugable pero sin descubrimientos/primera visita en la Enciclopedia.
  // Sin `tx` (llamada normal desde turnResolution.ts, ya fuera de su propia transacción) usa el
  // cliente global de siempre.
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  try {
    const normalized = normalizeText(params.mentionedText);
    const discovered: { entityType: string; entitySlug: string }[] = [];

    const [npcs, yields, items, inventoryItems, factionRows, historiaRows] = await Promise.all([
      client.npc.findMany({ where: { worldId: params.worldId } }),
      client.harvestYield.findMany({ where: { worldId: params.worldId } }),
      client.itemCatalog.findMany({ where: { worldId: params.worldId } }),
      client.inventoryItem.findMany({ where: { saveId: params.saveId } }),
      // Cascadas de descubrimiento (2026-08-06, secciones "Facciones"/"Historia" de la
      // Enciclopedia) — ver uso más abajo en los loops de npc/item. Catálogo (saveId null) + la
      // fundada en ESTA partida (reino.ts) — nunca la de otra partida distinta, aunque compartan
      // nombre (mismo filtro que /world/:slug/enciclopedia, ver world.ts).
      client.faction.findMany({ where: { worldId: params.worldId, OR: [{ saveId: null }, { saveId: params.saveId }] } }),
      client.historiaEntry.findMany({ where: { worldId: params.worldId } }),
    ]);
    const factionSlugByName = new Map(factionRows.map((f) => [f.name, f.slug]));
    const historiaSlugByDocumentoItemSlug = new Map(historiaRows.map((h) => [h.documentoItemSlug, h.slug]));

    // Misma exclusión que /world/:slug/enciclopedia (world.ts): la fauna cazable también tiene
    // fila Npc para el motor de escena — cuenta como 'fauna', no como 'npc', para no duplicar.
    const faunaSlugs = new Set(yields.map((y) => y.sourceSlug));

    for (const npc of npcs) {
      if (faunaSlugs.has(npc.slug)) continue;
      const aliases = [npc.name, ...npc.aliases];
      if (aliases.some((a) => matchesAliasBoundary(normalized, normalizeText(a)))) {
        discovered.push({ entityType: 'npc', entitySlug: npc.slug });
        // Cascada (2026-08-06, sección "Facciones"): descubrir un NPC de una facción también
        // descubre esa facción — igualdad exacta contra Faction.name, ver fail-fast en
        // seed-catalog.ts.
        if (npc.faction && factionSlugByName.has(npc.faction)) {
          discovered.push({ entityType: 'faction', entitySlug: factionSlugByName.get(npc.faction)! });
        }
      }
    }

    const sourceNameBySlug = new Map<string, string>();
    for (const y of yields) sourceNameBySlug.set(y.sourceSlug, y.sourceName);
    for (const [sourceSlug, sourceName] of sourceNameBySlug) {
      const aliases = [sourceName, ...(harvestSourceAliases[sourceSlug] ?? [])];
      if (aliases.some((a) => matchesAliasBoundary(normalized, normalizeText(a)))) {
        discovered.push({ entityType: 'fauna', entitySlug: sourceSlug });
      }
    }

    // Objetos: mención en narración O ya en inventario (petición explícita, "o sean objetos que
    // ya tenemos") — un guerrero de la escena puede llevar un objeto real del catálogo sin que el
    // jugador llegue nunca a poseerlo, y el equipo inicial nunca se "menciona" en ninguna
    // narración, así que ninguno de los dos criterios basta por sí solo.
    const ownedNames = new Set(inventoryItems.map((i) => normalizeText(i.name)));
    for (const item of items) {
      // Alias (2026-07-30, auditoría "revisar partida"): antes solo el nombre EXACTO y completo
      // de catálogo contaba — "Raciones de viaje" (nombre real del equipo inicial de Gorhorn,
      // startingInventory.ts) nunca enganchaba con "Ración de viaje" (catálogo, singular), así
      // que ese objeto nunca se "descubría" ni aunque el jugador ya lo llevara encima. Mismo
      // criterio que npc.aliases arriba: nombre O cualquier alias, por mención O por posesión.
      const itemNames = [item.name, ...(item.aliases ?? [])].map(normalizeText);
      const mentioned = itemNames.some((n) => matchesAliasBoundary(normalized, n));
      const owned = itemNames.some((n) => ownedNames.has(n));
      if (mentioned || owned) {
        discovered.push({ entityType: 'item', entitySlug: item.slug });
        // Cascada (2026-08-06, sección "Historia"): el objeto físico desbloquea SU HistoriaEntry
        // (solo revela que existe/es legible — la barrera de traducción, si aplica, se resuelve
        // en tiempo de lectura en /world/:slug/enciclopedia, no aquí).
        if (historiaSlugByDocumentoItemSlug.has(item.slug)) {
          discovered.push({ entityType: 'historia', entitySlug: historiaSlugByDocumentoItemSlug.get(item.slug)! });
        }
      }
    }

    if (discovered.length === 0) return;

    await client.discoveredEntity.createMany({
      data: discovered.map((d) => ({ saveId: params.saveId, entityType: d.entityType, entitySlug: d.entitySlug })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.error('[entityDiscovery] error registrando descubrimientos:', err);
  }
}
