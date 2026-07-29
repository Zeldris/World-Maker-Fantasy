import { prisma } from '../lib/prisma.js';
import { normalizeText, fuzzyMatchCandidates, fuzzyMatchesAnyStem } from './travel.js';
import { harvestSourceAliases } from '../scripts/worldCatalog.js';
import { scopeFor } from './npcScene.js';
import type { NpcKind, MetodoObtencion } from '@prisma/client';

/// Despiece/recolección (docs/12-mundo-estructurado.md § 3.3): el modelo narra, nunca decide qué
/// se consigue — el backend lee HarvestYield de la especie detectada y materializa InventoryItem.
///
/// Verbo por método (2026-07-29, petición explícita: "para conseguir estos recursos debes cazar...
/// o talar... o picar... a veces al explorar la zona me saca recursos que no tiene sentido obtener
/// directamente") — antes un único regex genérico servía para TODO tipo de recurso, sin distinguir
/// desollar fauna de talar madera de picar piedra. `PASIVO` no tiene regex propio a propósito:
/// nunca se resuelve por `detectHarvest` (una fuente nombrada exige SIEMPRE una acción deliberada),
/// solo puede salir del revelado pasivo genérico de discovery.ts.
const VERB_REGEX_BY_METODO: Record<Exclude<MetodoObtencion, 'PASIVO'>, RegExp> = {
  // El "cazar" en sí lo resuelve el combate — esto es solo el despiece/desollado posterior.
  CAZA: /despiez|desuell|desoll/,
  TALA: /tal[oae]|talando|hach(e|ea)|cort[oae].*(madera|le[ñn]a|arbol)/,
  MINERIA: /min[oae]|pic[ao]|extra(e|igo).*(roca|piedra|mena|mineral)/,
  EXTRACCION: /extra(e|igo)|arranc|recolect|cosech|recoj/,
};

/// Puro, separado de `detectHarvest` para poder testearlo sin BD (mismo criterio que
/// `matchHarvestSource`) — true si `action` usa el verbo que este método concreto exige. PASIVO
/// siempre false: nunca se resuelve por texto de fuente nombrada, solo por discovery.ts.
export function matchesVerbForMetodo(action: string, metodo: MetodoObtencion): boolean {
  if (metodo === 'PASIVO') return false;
  return VERB_REGEX_BY_METODO[metodo].test(normalizeText(action));
}

/// Tolerancia a erratas (roadmap 2026-07-20, P0 de Fable — auditoría de los demás detectores tras
/// el bug real de matchNpcAliases): mismo patrón exacto, distancia de edición ≤2 palabra a palabra
/// en palabras de 5+ letras cuando la coincidencia exacta de substring falla.
export function matchHarvestSource(action: string): string | undefined {
  const normalized = normalizeText(action);
  const words = fuzzyMatchCandidates(normalized);
  for (const [sourceSlug, aliases] of Object.entries(harvestSourceAliases)) {
    const hit = aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);
      if (normalized.includes(normalizedAlias)) return true;
      const aliasWords = fuzzyMatchCandidates(normalizedAlias);
      return words.some((w) => fuzzyMatchesAnyStem(w, aliasWords));
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
  /// Bug real (auditoría 2026-07-28): antes, una vez derrotada la fauna, el despiece se podía
  /// repetir turno tras turno sin límite (nada marcaba "ya se aprovechó este cadáver") — mismo
  /// defecto de idempotencia que el saqueo de NPCs con nombre, ya arreglado. true cuando ya se
  /// materializó el despiece de ESTE cadáver en esta partida — `yields` viene vacío a propósito.
  yaDespiezada?: boolean;
  /// Presentes solo cuando la fuente es fauna cazable (Npc real) — permiten a turnResolution.ts
  /// marcar `saqueado` en el mismo NpcState tras materializar el despiece, sin volver a consultar.
  npcId?: string;
  npcKind?: NpcKind;
}

/// Busca si la acción menciona una especie/planta cosechable del catálogo del mundo Y usa el
/// verbo que esa fuente concreta exige (2026-07-29 — antes bastaba cualquier verbo genérico de
/// recolección para CUALQUIER fuente, sin distinguir cazar/talar/picar/extraer). Devuelve null si
/// no se menciona ninguna fuente conocida o si el verbo usado no es el que esa fuente requiere.
export async function detectHarvest(params: {
  action: string;
  worldId: string;
  saveId: string;
  currentLocationId: string | null;
}): Promise<HarvestMatch | null> {
  const sourceSlug = matchHarvestSource(params.action);
  if (!sourceSlug) return null;

  const rows = await prisma.harvestYield.findMany({
    where: { worldId: params.worldId, sourceSlug },
    include: { item: true },
  });
  if (rows.length === 0) return null;

  // Invariante (validada en seed-catalog.ts): todas las filas de un mismo sourceSlug comparten
  // metodoObtencion — PASIVO nunca llega aquí (no tiene regex propio, solo sale de discovery.ts).
  if (!matchesVerbForMetodo(params.action, rows[0].metodoObtencion)) return null;

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
    // Bug real (auditoría 2026-07-28): sin esto, el mismo cadáver ya derrotado se podía despiezar
    // una y otra vez sin límite — reutiliza `saqueado` (el mismo campo que ya cierra el saqueo de
    // NPCs con nombre) como marca de "este cadáver ya no tiene nada más que dar".
    if (state?.saqueado) {
      return { sourceSlug, sourceName: rows[0].sourceName, yields: [], yaDespiezada: true };
    }
    return {
      sourceSlug,
      sourceName: rows[0].sourceName,
      yields: rows.map((r) => ({ itemName: r.item.name, cantidad: r.cantidad, condicion: r.condicion, itemSlug: r.item.slug })),
      npcId: faunaNpc.id,
      npcKind: faunaNpc.kind,
    };
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
  if (match.yaDespiezada) {
    return `DESPIECE/RECOLECCIÓN — ${match.sourceName}: este cadáver ya se despiezó antes en esta partida, no queda nada más que sacar de él. Narra que se busca pero ya no hay nada útil.`;
  }
  const parts = match.yields.map((y) => `${y.cantidad} ${y.itemName}${y.condicion ? ` (${y.condicion})` : ''}`);
  return `DESPIECE/RECOLECCIÓN — ${match.sourceName}: ${parts.join(', ')}. Esto es TODO lo que da.`;
}
