import { prisma } from '../lib/prisma.js';
import { normalizeText } from './travel.js';
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
export async function recordEntityDiscoveries(params: { saveId: string; worldId: string; mentionedText: string }): Promise<void> {
  try {
    const normalized = normalizeText(params.mentionedText);
    const discovered: { entityType: string; entitySlug: string }[] = [];

    const [npcs, yields, items, inventoryItems] = await Promise.all([
      prisma.npc.findMany({ where: { worldId: params.worldId } }),
      prisma.harvestYield.findMany({ where: { worldId: params.worldId } }),
      prisma.itemCatalog.findMany({ where: { worldId: params.worldId } }),
      prisma.inventoryItem.findMany({ where: { saveId: params.saveId } }),
    ]);

    // Misma exclusión que /world/:slug/enciclopedia (world.ts): la fauna cazable también tiene
    // fila Npc para el motor de escena — cuenta como 'fauna', no como 'npc', para no duplicar.
    const faunaSlugs = new Set(yields.map((y) => y.sourceSlug));

    for (const npc of npcs) {
      if (faunaSlugs.has(npc.slug)) continue;
      const aliases = [npc.name, ...npc.aliases];
      if (aliases.some((a) => normalized.includes(normalizeText(a)))) {
        discovered.push({ entityType: 'npc', entitySlug: npc.slug });
      }
    }

    const sourceNameBySlug = new Map<string, string>();
    for (const y of yields) sourceNameBySlug.set(y.sourceSlug, y.sourceName);
    for (const [sourceSlug, sourceName] of sourceNameBySlug) {
      const aliases = [sourceName, ...(harvestSourceAliases[sourceSlug] ?? [])];
      if (aliases.some((a) => normalized.includes(normalizeText(a)))) {
        discovered.push({ entityType: 'fauna', entitySlug: sourceSlug });
      }
    }

    // Objetos: mención en narración O ya en inventario (petición explícita, "o sean objetos que
    // ya tenemos") — un guerrero de la escena puede llevar un objeto real del catálogo sin que el
    // jugador llegue nunca a poseerlo, y el equipo inicial nunca se "menciona" en ninguna
    // narración, así que ninguno de los dos criterios basta por sí solo.
    const ownedNames = new Set(inventoryItems.map((i) => normalizeText(i.name)));
    for (const item of items) {
      const itemNameNormalized = normalizeText(item.name);
      if (normalized.includes(itemNameNormalized) || ownedNames.has(itemNameNormalized)) {
        discovered.push({ entityType: 'item', entitySlug: item.slug });
      }
    }

    if (discovered.length === 0) return;

    await prisma.discoveredEntity.createMany({
      data: discovered.map((d) => ({ saveId: params.saveId, entityType: d.entityType, entitySlug: d.entitySlug })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.error('[entityDiscovery] error registrando descubrimientos:', err);
  }
}
