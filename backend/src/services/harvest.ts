import { prisma } from '../lib/prisma.js';
import { normalizeText, fuzzyMatchCandidates, fuzzyMatchesAnyStem } from './travel.js';
import { harvestSourceAliases, sourceDisplayNameFor } from '../scripts/worldCatalog.js';
import { scopeFor, hasPendingLoot } from './npcScene.js';
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

// Bug real jugando en vivo (2026-09-01, partida Gorhorn/Hondonada del Eco): "Recojo mi hacha del
// suelo y sigo el rastro que ha dejado el canizor..." (intención de rastrear/seguir una presa, sin
// relación alguna con recolección) resolvió como RECOLECTAR Raíz de Fuego — el jugador nunca
// mencionó la planta ni la zona donde vive de verdad (Fumarolas Negras, no la Hondonada). Causa:
// "suelo" está a distancia Levenshtein 2 de "fuego" (s→f, l→g), la misma clase de colisión que
// NPC_ALIAS_FUZZY_EXCLUSIONS ya documenta en npcScene.ts ("lugar"~"hagar") — "suelo" es una palabra
// de terreno de uso constante en el juego, no una errata de "fuego". Mismo criterio: excluirla de
// los candidatos fuzzy en vez de tocar la tolerancia a erratas en general (sigue haciendo falta
// para erratas reales, ver test "corredr"~"corredor" en harvest.test.ts).
const HARVEST_ALIAS_FUZZY_EXCLUSIONS = new Set(['suelo']);

/// Tolerancia a erratas (roadmap 2026-07-20, P0 de Fable — auditoría de los demás detectores tras
/// el bug real de matchNpcAliases): mismo patrón exacto, distancia de edición ≤2 palabra a palabra
/// en palabras de 5+ letras cuando la coincidencia exacta de substring falla.
export function matchHarvestSource(action: string): string | undefined {
  const normalized = normalizeText(action);
  const words = fuzzyMatchCandidates(normalized).filter((w) => !HARVEST_ALIAS_FUZZY_EXCLUSIONS.has(w));
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

/// Rediseño de profesiones (2026-08-07): "ya localizado en la zona" para el pop-up de una
/// habilidad de recolección (Minar/Talar/...) — mismo espíritu que `detectNpcsInScene`
/// (npcScene.ts), pero sobre fuentes de recolección: busca alias de cada `sourceSlug` candidato
/// mencionados en los hechos de sesión recientes de la partida. Puro, sin BD (mismo criterio que
/// `matchHarvestSource`) — el caller decide qué `candidateSlugs` tienen sentido (p.ej. las fuentes
/// MINERIA con población real > 0 en la región actual, ver /saves/:id/recolectar).
export function detectHarvestSourcesInScene(sessionFacts: string[], candidateSlugs: string[]): string[] {
  const normalizedFacts = normalizeText(sessionFacts.join(' \n '));
  return candidateSlugs.filter((slug) => {
    const aliases = harvestSourceAliases[slug] ?? [];
    return aliases.some((alias) => normalizedFacts.includes(normalizeText(alias)));
  });
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
  const sourceName = sourceDisplayNameFor(sourceSlug, faunaNpc?.name);
  if (faunaNpc) {
    const scope = scopeFor(faunaNpc.kind, params.currentLocationId);
    const state = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: params.saveId, npcId: faunaNpc.id, scope } } });
    // Caza en grupo (2026-08-13) — con `groupSize` puesto, el individuo ACTUAL puede haber
    // "resucitado" a ILESO para seguir el combate contra el resto (ver
    // applyCombatExchangeToNpcState, turnResolution.ts) aunque YA haya cadáveres reales caídos
    // (`groupDefeated > 0`) esperando despiece — `condicionFisica` sola ya no basta para decidir
    // si hay presa que despiezar.
    const derrotada = state?.condicionFisica === 'CONVALECIENTE' || state?.condicionFisica === 'MUERTO' || !!state?.groupDefeated;
    if (!derrotada) {
      return { sourceSlug, sourceName, yields: [], requierePresaPrevia: true };
    }
    // Bug real (auditoría 2026-07-28): sin esto, el mismo cadáver ya derrotado se podía despiezar
    // una y otra vez sin límite — `saqueado` (individuo solitario) o `corpsesLooted` (grupo, ver
    // comentario del campo en schema.prisma) marcan "esto ya no tiene nada más que dar AHORA
    // MISMO" — un grupo puede volver a tener presa real más adelante si cae otro individuo más.
    // `!hasPendingLoot(state)` (npcScene.ts, auditoría de deuda técnica 2026-08-18) — único punto
    // de verdad del mismo criterio, compartido con `recolectar.ts`/`panels.ts`.
    const yaDespiezada = !hasPendingLoot(state);
    if (yaDespiezada) {
      return { sourceSlug, sourceName, yields: [], yaDespiezada: true };
    }
    return {
      sourceSlug,
      sourceName,
      yields: rows.map((r) => ({ itemName: r.item.name, cantidad: r.cantidad, condicion: r.condicion, itemSlug: r.item.slug })),
      npcId: faunaNpc.id,
      npcKind: faunaNpc.kind,
    };
  }

  return {
    sourceSlug,
    sourceName,
    yields: rows.map((r) => ({ itemName: r.item.name, cantidad: r.cantidad, condicion: r.condicion, itemSlug: r.item.slug })),
  };
}
