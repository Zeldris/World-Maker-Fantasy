import { npcDeLaPartida } from './mundoPartida.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { normalizeText, matchesAliasBoundary } from './travel.js';
import { harvestSourceAliases, sourceDisplayNameFor, harvestSourcesThatAreFaunaWithoutNpc } from '../scripts/worldCatalog.js';

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
///
/// Rediseño de 3 fases (2026-09-08, petición explícita de Álvaro: "no descubierto, citado o
/// avistado... 1. no descubierto... 2. citado: lo han citado o mencionado pero no has llegado a
/// 'verlo' en escena... 3. descubierto: toda la información visible... cuando ese elemento se vea
/// en escena o por elementos de lore") — CAMBIA la filosofía original de este archivo (el
/// comentario de `turnResolution.ts` decía "descubrimiento narrativo, no automático por
/// presencia", ahora es justo al revés para la fase final): una simple mención en narración/
/// `new_facts` (lo que este archivo ya detectaba) solo llega a CITADO — ficha mínima
/// (nombre+región). Llegar a DESCUBIERTO (ficha completa, con imagen) exige una señal de
/// presencia REAL, no solo textual — `presentInScene` (slugs realmente en `npcsInScene`/objeto ya
/// en inventario, que SIEMPRE implica posesión real, nunca solo mención) decide cuál de las dos.
export async function recordEntityDiscoveries(
  params: {
    saveId: string;
    worldId: string;
    mentionedText: string;
    /// Señales de presencia REAL de este turno (2026-09-08) — slugs de NPC/fauna que de verdad
    /// están en `npcsInScene` ahora mismo (no solo citados en prosa). Opcional: sin este dato
    /// (callers antiguos, p.ej. `cazar.ts`/`recolectar.ts`/`turn.ts` con reveal narrativo) toda
    /// mención cae en CITADO como mucho, nunca en DESCUBIERTO — ningún caller existente empeora,
    /// solo el que sí pase la señal puede llegar a la fase completa.
    npcSlugsInScene?: string[];
  },
  // Cliente opcional de transacción (auditoría 2026-07-28, fix #9): al crear/reiniciar partida se
  // pasa el `tx` de la transacción que ya está creando el Save, para que un crash a mitad de
  // proceso no deje la partida jugable pero sin descubrimientos/primera visita en la Enciclopedia.
  // Sin `tx` (llamada normal desde turnResolution.ts, ya fuera de su propia transacción) usa el
  // cliente global de siempre.
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  try {
    const normalized = normalizeText(params.mentionedText);
    const npcSlugsInSceneSet = new Set(params.npcSlugsInScene ?? []);
    const discovered: { entityType: string; entitySlug: string; fase: 'CITADO' | 'DESCUBIERTO' }[] = [];

    const [npcs, yields, items, inventoryItems, factionRows, historiaRows] = await Promise.all([
      client.npc.findMany({ where: { worldId: params.worldId, ...npcDeLaPartida(params.saveId) } }),
      client.harvestYield.findMany({ where: { worldId: params.worldId } }),
      client.itemCatalog.findMany({ where: { worldId: params.worldId } }),
      client.inventoryItem.findMany({ where: { saveId: params.saveId } }),
      // Cascadas de descubrimiento (2026-08-06, secciones "Facciones"/"Historia" de la
      // Enciclopedia) — ver uso más abajo en los loops de npc/item. Catálogo (saveId null) + la
      // fundada en ESTA partida (reino.ts) — nunca la de otra partida distinta, aunque compartan
      // nombre (mismo filtro que /world/:slug/enciclopedia, ver world.ts).
      client.faction.findMany({ where: { worldId: params.worldId, OR: [{ saveId: null }, { saveId: params.saveId, origenSlug: null }] } }),
      client.historiaEntry.findMany({ where: { worldId: params.worldId } }),
    ]);
    const factionSlugByName = new Map(factionRows.map((f) => [f.name, f.slug]));
    const historiaSlugByDocumentoItemSlug = new Map(historiaRows.map((h) => [h.documentoItemSlug, h.slug]));

    // Misma exclusión que /world/:slug/enciclopedia (world.ts): la fauna cazable también tiene
    // fila Npc para el motor de escena — cuenta como 'fauna', no como 'npc', para no duplicar.
    const faunaSlugs = new Set(yields.map((y) => y.sourceSlug));

    for (const npc of npcs) {
      if (faunaSlugs.has(npc.slug)) continue;
      // Mismo hallazgo que npcScene.ts (auditoría 2026-08-14, Sella Marn) — un NPC de una región
      // fuera del núcleo jugable no debería poder desbloquearse en la Enciclopedia por un match
      // de alias corto ("sella") en texto que no tiene nada que ver con él.
      if (npc.nucleoJugable === false) continue;
      const aliases = [npc.name, ...npc.aliases];
      if (aliases.some((a) => matchesAliasBoundary(normalized, normalizeText(a)))) {
        // 3 fases (2026-09-08): presente de verdad en `npcsInScene` este turno -> DESCUBIERTO
        // (ficha completa); solo citado en prosa/hechos -> CITADO (nombre+región nada más).
        const fase = npcSlugsInSceneSet.has(npc.slug) ? 'DESCUBIERTO' : 'CITADO';
        discovered.push({ entityType: 'npc', entitySlug: npc.slug, fase });
        // Cascada (2026-08-06, sección "Facciones"): descubrir un NPC de una facción también
        // descubre esa facción — igualdad exacta contra Faction.name, ver fail-fast en
        // seed-catalog.ts. La facción en sí no tiene "presencia en escena" propia — hereda CITADO
        // siempre, nunca DESCUBIERTO solo por la cascada (mismo criterio conservador que el resto).
        if (npc.faction && factionSlugByName.has(npc.faction)) {
          discovered.push({ entityType: 'faction', entitySlug: factionSlugByName.get(npc.faction)!, fase: 'CITADO' });
        }
      }
    }

    const npcNameBySlug = new Map(npcs.map((n) => [n.slug, n.name]));
    // Auditoría "revisar partida" (2026-08-30, "fauna y flora en carpetas separadas") — bug real
    // encontrado de paso: `buildFaunaFloraSection` (routes/world.ts) ahora resuelve dinámicamente
    // 'fauna' o 'flora' según el mismo criterio de abajo, pero `isDiscovered` compara el
    // `entityType` de forma EXACTA contra lo que ya está grabado en `DiscoveredEntity` — si aquí
    // se seguía grabando SIEMPRE 'fauna', TODA la flora/mineral se habría quedado bloqueada para
    // siempre en la Enciclopedia (el candado nunca habría coincidido). Mismo criterio real que
    // `esFauna`/`imageEntityTypeFor`: un NPC cazable, o uno de los 3 animales sin ficha propia.
    const npcSlugsSet = new Set(npcs.map((n) => n.slug));
    for (const sourceSlug of faunaSlugs) {
      const sourceName = sourceDisplayNameFor(sourceSlug, npcNameBySlug.get(sourceSlug));
      const aliases = [sourceName, ...(harvestSourceAliases[sourceSlug] ?? [])];
      if (aliases.some((a) => matchesAliasBoundary(normalized, normalizeText(a)))) {
        const entityType = npcSlugsSet.has(sourceSlug) || harvestSourcesThatAreFaunaWithoutNpc.has(sourceSlug) ? 'fauna' : 'flora';
        // 3 fases (2026-09-08) — mismo criterio que NPC: fauna realmente en escena este turno ->
        // DESCUBIERTO; flora (nunca tiene fila real en npcsInScene, no es un "personaje" de escena)
        // se queda en CITADO por este camino — llegar a DESCUBIERTO para flora exigiría el otro
        // disparador pendiente de diseñar (ver tarkor_diseno_movimiento_zona_transito_real: "el
        // hecho de interactuar ya lo descubre"), fuera del alcance de esta pieza.
        const fase = npcSlugsInSceneSet.has(sourceSlug) ? 'DESCUBIERTO' : 'CITADO';
        discovered.push({ entityType, entitySlug: sourceSlug, fase });
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
        // 3 fases (2026-09-08): un objeto que el jugador YA LLEVA es presencia real de sobra (más
        // fuerte que "verlo en escena" — lo tiene encima) -> DESCUBIERTO directo. Solo mencionado
        // sin poseerlo (p.ej. el arma de un NPC que aparece en su descripción) -> CITADO.
        const fase = owned ? 'DESCUBIERTO' : 'CITADO';
        discovered.push({ entityType: 'item', entitySlug: item.slug, fase });
        // Cascada (2026-08-06, sección "Historia"): el objeto físico desbloquea SU HistoriaEntry
        // (solo revela que existe/es legible — la barrera de traducción, si aplica, se resuelve
        // en tiempo de lectura en /world/:slug/enciclopedia, no aquí). Hereda la MISMA fase que el
        // objeto que la desbloqueó — tener el libro en la mano también debería poder leer su ficha
        // completa, solo saber que existe por mención no.
        if (historiaSlugByDocumentoItemSlug.has(item.slug)) {
          discovered.push({ entityType: 'historia', entitySlug: historiaSlugByDocumentoItemSlug.get(item.slug)!, fase });
        }
      }
    }

    if (discovered.length === 0) return;

    // Dedupe dentro de ESTE turno (2026-09-08) — un mismo NPC puede llegar dos veces al array
    // (p.ej. citado en `narration` Y en `newFacts`), quedándose con la fase MÁS ALTA de las dos
    // detecciones de este turno antes de tocar la base de datos.
    const bestFaseByKey = new Map<string, (typeof discovered)[number]>();
    for (const d of discovered) {
      const key = `${d.entityType}:${d.entitySlug}`;
      const existing = bestFaseByKey.get(key);
      if (!existing || (d.fase === 'DESCUBIERTO' && existing.fase !== 'DESCUBIERTO')) bestFaseByKey.set(key, d);
    }

    // `upsert` en vez de `createMany` (2026-09-08, 3 fases) — una fila ya DESCUBIERTO no debe
    // poder "bajar" a CITADO si una detección de este turno solo llega a CITADO (p.ej. el jugador
    // ya vio al NPC en persona hace turnos, ahora solo lo menciona de pasada) — `update` únicamente
    // cuando la fase nueva es estrictamente mejor que la existente, nunca un downgrade.
    await Promise.all(
      [...bestFaseByKey.values()].map(async (d) => {
        const existing = await client.discoveredEntity.findUnique({
          where: { saveId_entityType_entitySlug: { saveId: params.saveId, entityType: d.entityType, entitySlug: d.entitySlug } },
          select: { fase: true },
        });
        if (!existing) {
          await client.discoveredEntity.create({ data: { saveId: params.saveId, entityType: d.entityType, entitySlug: d.entitySlug, fase: d.fase } });
        } else if (existing.fase !== 'DESCUBIERTO' && d.fase === 'DESCUBIERTO') {
          await client.discoveredEntity.update({
            where: { saveId_entityType_entitySlug: { saveId: params.saveId, entityType: d.entityType, entitySlug: d.entitySlug } },
            data: { fase: 'DESCUBIERTO' },
          });
        }
      }),
    );
  } catch (err) {
    console.error('[entityDiscovery] error registrando descubrimientos:', err);
  }
}
