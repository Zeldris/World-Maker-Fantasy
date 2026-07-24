import { prisma } from '../lib/prisma.js';
import { normalizeText, levenshtein } from './travel.js';
import { harvestSourceAliases } from '../scripts/worldCatalog.js';
import { scopeFor } from './npcScene.js';

/// Despiece/recolección (docs/12-mundo-estructurado.md § 3.3): el modelo narra, nunca decide qué
/// se consigue — el backend lee HarvestYield de la especie detectada y materializa InventoryItem.

const HARVEST_INTENT_REGEX = /despiez|recolect|recoj|cosech|caz|extra(e|igo)|arranc/;

export function detectsHarvestIntent(action: string): boolean {
  return HARVEST_INTENT_REGEX.test(normalizeText(action));
}

/// Tolerancia a erratas (roadmap 2026-07-20, P0 de Fable — auditoría de los demás detectores tras
/// el bug real de matchNpcAliases): mismo patrón exacto, distancia de edición ≤2 palabra a palabra
/// en palabras de 5+ letras cuando la coincidencia exacta de substring falla.
export function matchHarvestSource(action: string): string | undefined {
  const normalized = normalizeText(action);
  const words = normalized.split(/\s+/).filter((w) => w.length >= 5);
  for (const [sourceSlug, aliases] of Object.entries(harvestSourceAliases)) {
    const hit = aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);
      if (normalized.includes(normalizedAlias)) return true;
      return normalizedAlias
        .split(/\s+/)
        .filter((w) => w.length >= 5)
        .some((aliasWord) => words.some((w) => levenshtein(w, aliasWord) <= 2));
    });
    if (hit) return sourceSlug;
  }
  return undefined;
}

export interface HarvestYieldEntry {
  itemName: string;
  cantidad: number;
  condicion: string | null;
  /// Slug de ItemCatalog (sesión de diseño 2026-07-23) — se copia al InventoryItem.catalogSlug
  /// real al materializar, para poder mirar sus requisitos de equipar (ver requisitos.ts).
  itemSlug: string;
}

export interface HarvestMatch {
  sourceSlug: string;
  sourceName: string;
  yields: HarvestYieldEntry[];
  /// Roadmap 2026-07-19 (prioridad 1, "despiece exige presa previa"): true cuando esta especie es
  /// fauna cazable (existe como Npc, ver worldCatalog.ts `fauna`) y todavía no se ha derrotado en
  /// ESTA partida (NpcState) — `yields` viene vacío a propósito, no hay nada que materializar.
  requierePresaPrevia?: boolean;
}

/// Busca si la acción menciona una especie/planta cosechable del catálogo del mundo. Devuelve
/// null si no hay intención de despiece/recolección o la especie mencionada no tiene catálogo.
export async function detectHarvest(params: {
  action: string;
  worldId: string;
  saveId: string;
  currentLocationId: string | null;
}): Promise<HarvestMatch | null> {
  if (!detectsHarvestIntent(params.action)) return null;

  const sourceSlug = matchHarvestSource(params.action);
  if (!sourceSlug) return null;

  const rows = await prisma.harvestYield.findMany({
    where: { worldId: params.worldId, sourceSlug },
    include: { item: true },
  });
  if (rows.length === 0) return null;

  // Fauna cazable (mismo slug que su Npc en worldCatalog.ts): sin haberla derrotado en esta
  // partida, no hay presa que despiezar — antes esto era repetible infinito sin cazar nada.
  const faunaNpc = await prisma.npc.findUnique({ where: { worldId_slug: { worldId: params.worldId, slug: sourceSlug } } });
  if (faunaNpc) {
    const scope = scopeFor(faunaNpc.kind, params.currentLocationId);
    const state = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: params.saveId, npcId: faunaNpc.id, scope } } });
    const derrotada = state?.condicionFisica === 'INCAPACITADO' || state?.condicionFisica === 'MUERTO';
    if (!derrotada) {
      return { sourceSlug, sourceName: rows[0].sourceName, yields: [], requierePresaPrevia: true };
    }
  }

  return {
    sourceSlug,
    sourceName: rows[0].sourceName,
    yields: rows.map((r) => ({ itemName: r.item.name, cantidad: r.cantidad, condicion: r.condicion, itemSlug: r.item.slug })),
  };
}

/// Bloque de prompt (§ 3.3): "Esto es TODO lo que da" — cierra la puerta a que el modelo invente
/// algo más allá de la lista fija.
export function harvestBlockFor(match: HarvestMatch): string {
  if (match.requierePresaPrevia) {
    return `DESPIECE/RECOLECCIÓN — ${match.sourceName}: todavía no se ha cazado/derrotado ninguno en esta partida, así que no hay ningún cadáver o presa que despiezar ahora mismo. Narra que se intenta pero no se encuentra nada que aprovechar.`;
  }
  const parts = match.yields.map((y) => `${y.cantidad} ${y.itemName}${y.condicion ? ` (${y.condicion})` : ''}`);
  return `DESPIECE/RECOLECCIÓN — ${match.sourceName}: ${parts.join(', ')}. Esto es TODO lo que da.`;
}
