import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { stripRegionArticle } from '../../services/population.js';
import { pasaFiltroTerreno } from '../../services/terrain.js';
import { locationTerrainTags, faunaTerrainTag, harvestSourceHomeLocationSlug } from '../../scripts/worldCatalog.js';
import { matchesHarvestSourceHome } from '../../services/harvest.js';
import { pickAmbientEncounterCandidate, difficultyHintFor } from '../../services/npcScene.js';
import { detectHarvestSourcesInScene } from '../../services/harvest.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import type { AttributeBlock } from '../../services/dice.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import {
  iniciarCaza,
  dispersionCooldownActivo,
  rollGroupEngagement,
  groupVarianceClause,
  type CazaTarget,
} from '../../services/caza.js';

// Reexportadas (2026-09-28, Fase 2 — servicio `caza.ts` extraído de esta ruta) para no romper a
// quien las importaba desde aquí (`cazar.test.ts`, mismos tests de siempre, sin cambios).
export { dispersionCooldownActivo, rollGroupEngagement, groupVarianceClause };

// Checklist consolidado P3.6 (2026-08-27) — "Cazar" limpio no avanzaba el reloj de ficción, mismo
// hueco ya cerrado en recolectar.ts (Minar/Talar) el 2026-08-14. Cifra fija (no hay cantidad
// variable que escalar, a diferencia de recolección) — mismo criterio base que
// RECOLECCION_MINUTOS_BASE (recolectar.ts).
const CAZA_LIMPIA_MINUTOS = 10;

/// Caza (revisión de partida 2026-08-08, "buscar presas... eso no va, sale un pequeño raposa que
/// desaparece sin más" + diseño consultado con la usuaria): el texto libre nunca conectaba de
/// forma fiable con la fauna real del catálogo — dependía de una sugerencia ambiental opcional al
/// 25%, ajena a que el jugador estuviera cazando de verdad (turnResolution.ts ~L1191), así que el
/// modelo acababa inventando animales fuera del roster ("raposa" no existe en ningún sitio del
/// mundo). Mismo criterio que recolectar.ts (Minar/Talar): un pop-up determinista con la fauna
/// real y con población activa en la zona ahora mismo, sin depender del Narrador para decidir con
/// qué te cruzas.
///
/// Diseño de la resolución (decidido con la usuaria): elegir una ÚNICA presa "muy débil" frente al
/// personaje (nivel ≤ nivel del jugador − 2, mismo umbral que la banda "Fácil" de
/// `difficultyHintFor`, npcScene.ts) ofrece una tirada de caza limpia sin combate — % = su
/// `capturablePct` de catálogo (dato ya sembrado y sin ningún caller hasta hoy, pensado
/// explícitamente para esto, ver comentario de schema.prisma § Npc.capturablePct) + la destreza del
/// personaje, tope 90 para que nunca sea un éxito garantizado. Elegir varias presas a la vez —
/// aunque cada una sea débil por separado — siempre exige combate real contra todas: la propia
/// usuaria lo decidió así ("el % de caza auto solo saltara si eliges una unica presa, si es varias
/// es combate obligatorio").
///
/// Bug de diseño evitado a tiempo (misma conversación): la primera versión de esta ruta abría el
/// combate ELLA MISMA (NpcState + `pendingCombatNpcSlugs` directos, sin narración) para el caso
/// "toca pelear" — la usuaria corrigió: "cazar sí que fuerza una narración cuando eliges objetivos
/// y esa narración inicia el combate". Así que esta ruta SOLO decide de forma determinista (nunca
/// el modelo) si hay caza limpia y, si la hay, si sale bien — el caso "toca pelear" no escribe nada
/// de combate aquí: solo valida y devuelve a qué presas nombrar, y el FRONTEND manda ese texto por
/// el mismo `handleSubmit` de cualquier acción libre (GameView.tsx) — narración real +
/// `shouldForceCombat`/`detectNpcsInScene` (turnResolution.ts) abren el combate exactamente igual
/// que si el jugador hubiera escrito "Ataco a 'X'" él mismo, sin duplicar ninguna lógica de combate.
///
/// Solo se admite UNA presa por especie por petición (no cantidad/stock por especie): `NpcState`
/// usa `scope = Location.id` para una `PLANTILLA` (npcScene.ts § scopeFor) — dos individuos de la
/// MISMA especie a la vez en el mismo sitio violarían el `@@unique([saveId, npcId, scope])` sin
/// un rediseño mayor del propio modelo de encuentros. Cazar varias especies distintas a la vez
/// (cada una su propio `npcId`) no tiene ese problema y es justo lo que pide "combate contra tantos
/// enemigos como selecciones de la lista".
const NIVEL_DIFERENCIA_PRESA_DEBIL = 2;
const CHANCE_CAZA_LIMPIA_TOPE = 90;

/// Localización real (2026-08-08, "podría pelear/cazar cualquier presa en cualquier zona... a lo
/// mejor hay 2 múrgol, 8 corretolvas y 1 gargantúa, o puede que no encuentres nada, como los
/// objetos"): antes CUALQUIER especie con población > 0 en TODA la región (Llanuras del Viento
/// Rojo puede tener miles de individuos, worldPopulation.ts) aparecía siempre en el pop-up, sin
/// importar el punto exacto donde estuviera el jugador ni si de verdad había rastro de ella ahí.
/// Mismo patrón en dos pasos que Minar/Talar (recolectar.ts): "ya localizado" (hechos de sesión,
/// reutilizando `detectHarvestSourcesInScene` — los mismos alias sirven para fauna, cada especie
/// cazable ya es también una fuente de despiece) vs "Explorar" (determinista, sin gastar turno).
///
/// La CANTIDAD mostrada ("avistados") nunca es la población mundial real (miles) ni una tirada
/// aleatoria que haya que recordar entre peticiones — se deriva de `capturablePct` (cifra ya
/// curada a mano por especie: 80 para Múrgol/dócil y común, 10 para Cruzavientos/Gargantúa/rara),
/// topada por la población real restante para que baje sola a medida que se caza de verdad, sin
/// inventar un contador nuevo que persistir.
const CAZA_AVISTAMIENTO_DIVISOR = 10;

export function avistadosFor(capturablePct: number, poblacion: number): number {
  return Math.min(poblacion, Math.max(1, Math.round(capturablePct / CAZA_AVISTAMIENTO_DIVISOR)));
}

export interface HuntCandidate {
  slug: string;
  name: string;
  level: number;
  debil: boolean;
  poblacion: number;
  capturablePct: number;
}

interface SightedHuntCandidate {
  slug: string;
  name: string;
  level: number;
  debil: boolean;
  avistados: number;
  /// Dificultad real de enfrentarse a esta presa (petición explícita, 2026-08-14: "las presas
  /// listadas deberían salir en verde, amarillo o rojo según su dificultad... hover indicando la
  /// dificultad") — mismo `difficultyHintFor` que ya calibra la tirada de ataque normal
  /// (npcScene.ts), nunca un cálculo aparte a mano en el frontend.
  dificultad: number;
  dificultadLabel: string;
}

function toSighted(c: HuntCandidate, playerLevel: number): SightedHuntCandidate {
  const { dificultad, label } = difficultyHintFor(c.level, playerLevel);
  return {
    slug: c.slug,
    name: c.name,
    level: c.level,
    debil: c.debil,
    avistados: avistadosFor(c.capturablePct, c.poblacion),
    dificultad,
    dificultadLabel: label,
  };
}

export async function candidateFaunaFor(
  worldId: string,
  region: string | null,
  playerLevel: number,
  locationSlug: string | null,
  currentLocationId: string | null,
  fictionalMinutes: number,
): Promise<HuntCandidate[]> {
  if (!region) return [];
  const populations = await prisma.worldPopulation.findMany({
    where: { worldId, targetType: 'FAUNA', poblacion: { gt: 0 } },
  });
  const withRegion = populations.filter((pop) => {
    const distribucion = pop.distribucion as Record<string, number>;
    if (!((distribucion[stripRegionArticle(region)] ?? 0) > 0)) return false;
    // Filtro por hábitat de la zona (petición explícita, 2026-08-14: "con la de peleteria en caza
    // pues dependiendo del habita de cada fauna") — mismo criterio que candidateSourcesFor
    // (recolectar.ts), ver terrain.ts.
    if (!pasaFiltroTerreno(locationSlug ? locationTerrainTags[locationSlug] : undefined, faunaTerrainTag[pop.targetSlug])) return false;
    // Candado de Location (hallazgo 29b, revisar-partida-hallazgos.md 2026-09-07) — mismo criterio
    // que `candidateSourcesFor` (recolectar.ts): sin entrada en `harvestSourceHomeLocationSlug`,
    // sigue elegible en toda la región (comportamiento de siempre); con entrada, exige que la
    // Location actual esté anclada (una sola o varias a la vez).
    if (!matchesHarvestSourceHome(harvestSourceHomeLocationSlug[pop.targetSlug], locationSlug)) return false;
    // Cooldown de dispersión (2026-09-02) — solo bloquea si la dispersión ocurrió en ESTA MISMA
    // Location (`dispersadoEnLocationId`, no solo la misma región) y el cooldown de ficción sigue
    // activo. Sin `currentLocationId` (p.ej. sin ubicación resuelta), nunca bloquea.
    if (currentLocationId && pop.dispersadoEnLocationId === currentLocationId && dispersionCooldownActivo(pop.dispersadoDesdeMinutes, fictionalMinutes)) {
      return false;
    }
    return true;
  });
  if (withRegion.length === 0) return [];

  const poblacionBySlug = new Map(withRegion.map((p) => [p.targetSlug, p.poblacion]));
  const npcs = await prisma.npc.findMany({
    where: { worldId, slug: { in: withRegion.map((p) => p.targetSlug) } },
    select: { slug: true, name: true, level: true, capturablePct: true, medio: true },
  });
  // Gate de alcanzabilidad (2026-09-08, precisión explícita de la usuaria): AEREO NO bloquea Cazar
  // — "que sea aéreo no implica que siempre esté en el aire... en combate se posa en el suelo, y si
  // es agresiva se posará para combatir". Solo PURAMENTE ACUATICO se excluye aquí, siempre:
  // "actualmente todo lo que sea puramente acuático será narrativo, o los combates solo se podrán
  // realizar con criaturas que además puedan ir a tierra... las puramente acuáticas son narrativas
  // o para obtener recursos mediante pesca y desollar" — nunca vía Cazar. Un anfibio real (`medio`
  // incluye TERRESTRE junto a ACUATICO) SÍ sigue siendo candidato — solo se excluye cuando ACUATICO
  // es el ÚNICO medio declarado. AEREO sigue siendo candidato normal aquí; el gate de AEREO vive
  // solo en el disparador de Interactuar (la escena/narración decide si está posado o no en ESE
  // turno concreto), no en el motor de caza en sí.
  return npcs
    .filter((npc) => !(npc.medio.length === 1 && npc.medio[0] === 'ACUATICO'))
    .map((npc) => ({
      slug: npc.slug,
      name: npc.name,
      level: npc.level,
      debil: npc.level <= playerLevel - NIVEL_DIFERENCIA_PRESA_DEBIL,
      poblacion: poblacionBySlug.get(npc.slug) ?? 0,
      capturablePct: npc.capturablePct,
    }));
}

/// Tirada de "Explorar" (determinista salvo por el propio azar de qué hay cerca, igual que un
/// encuentro ambiental real): hasta 3 intentos, cada uno con un 35% de fallar sin más (para que
/// "no encuentras nada" sea un resultado real, no solo cuando la región está vacía de verdad) y si
/// no falla, una tirada ponderada por población real (mismo peso que ya usa la sugerencia de
/// encuentro ambiental de turnResolution.ts) sobre los candidatos reales de la región.
const CAZA_EXPLORAR_INTENTOS = 3;
const CAZA_EXPLORAR_CHANCE_FALLO = 0.35;

// `rollGroupEngagement`/`groupVarianceClause` viven ahora en `services/caza.ts` (Fase 2,
// 2026-09-28) — importadas y reexportadas arriba, sin cambiar su comportamiento.

export function rollSightings(candidates: HuntCandidate[], random: () => number = Math.random): HuntCandidate[] {
  const found = new Map<string, HuntCandidate>();
  for (let i = 0; i < CAZA_EXPLORAR_INTENTOS; i++) {
    if (random() < CAZA_EXPLORAR_CHANCE_FALLO) continue;
    const pick = pickAmbientEncounterCandidate(
      candidates.map((c) => ({ slug: c.slug, name: c.name, role: '', weight: c.poblacion })),
      random,
    );
    if (pick) found.set(pick.slug, candidates.find((c) => c.slug === pick.slug)!);
  }
  return [...found.values()];
}

export async function cazarRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/saves/:id/cazar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { currentLocation: true, worldState: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const candidates = await candidateFaunaFor(
      save.worldId,
      save.currentLocation?.region ?? null,
      save.level,
      save.currentLocation?.slug ?? null,
      save.currentLocation?.id ?? null,
      save.worldState?.fictionalMinutes ?? 0,
    );
    if (candidates.length === 0) return { candidates: [], puedeExplorar: false };

    const sessionFacts = await loadSessionFacts(save.id);
    const localizados = detectHarvestSourcesInScene(
      sessionFacts,
      candidates.map((c) => c.slug),
    );
    const sighted = candidates.filter((c) => localizados.includes(c.slug));
    return { candidates: sighted.map((c) => toSighted(c, save.level)), puedeExplorar: sighted.length === 0 };
  });

  // Determinista, sin gastar turno ni pasar por Ollama (mismo criterio que recolectar.ts) — pero,
  // a diferencia de recolectar (que revela SIEMPRE todo lo real de la región), aquí hay una tirada
  // real de qué se encuentra (`rollSightings`): puede no salir nada, igual que explorar en busca de
  // recursos y no dar con ninguno.
  app.post<{ Params: { id: string } }>('/saves/:id/cazar/explorar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { currentLocation: true, worldState: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    // Bug real (auditoría de bugs, 2026-08-21): a diferencia de /turn/classify y /combat/flee
    // (session.ts), ninguna ruta de caza comprobaba `save.endedAt` — con la partida ya terminada
    // por muerte definitiva (docs/14-combate-y-muerte.md § 4.4), el composer principal queda
    // bloqueado en el frontend, pero el panel de Habilidades/Cazar sigue accesible y permitía
    // seguir cazando (mutando `WorldPopulation`/`NpcState` de verdad) para un personaje que la
    // propia partida ya da por definitivamente muerto.
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    const candidates = await candidateFaunaFor(
      save.worldId,
      save.currentLocation?.region ?? null,
      save.level,
      save.currentLocation?.slug ?? null,
      save.currentLocation?.id ?? null,
      save.worldState?.fictionalMinutes ?? 0,
    );
    // Bug real jugando en vivo (2026-09-03, "mensaje de caza ambiguo"): `candidates.length === 0`
    // (de verdad no hay fauna real en esta región/ubicación ahora mismo) y `sighted.length === 0`
    // (SÍ hay fauna real, pero falló la tirada de avistamiento — ~4% de fallar los 3 intentos
    // seguidos) devolvían la misma respuesta `{ candidates: [] }`, sin que el frontend pudiera
    // distinguir "vacío real, no insistas" de "mala suerte esta vez, reintenta". `vacioReal` marca
    // el primer caso — el frontend solo cierra la puerta a reintentar cuando es `true`.
    if (candidates.length === 0) return { candidates: [], vacioReal: true };

    const sighted = rollSightings(candidates);
    if (sighted.length === 0) return { candidates: [], vacioReal: false };

    const sightedInfo = sighted.map((c) => toSighted(c, save.level));
    const text = `${save.characterName} detecta señales de fauna cerca: ${sightedInfo.map((c) => `${c.avistados} ${c.name}`).join(', ')}.`;
    const sessionFacts = await loadSessionFacts(save.id);
    await appendSessionFacts(save.id, sessionFacts, [text]);

    return { candidates: sightedInfo };
  });


  app.post<{ Params: { id: string }; Body: { slugs: string[]; cantidades?: Record<string, number> } }>('/saves/:id/cazar/confirmar', async (request, reply) => {
    const { slugs, cantidades } = request.body;
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return reply.status(400).send({ error: 'Falta el campo: slugs' });
    }

    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { currentLocation: true, worldState: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    // Bug real (auditoría de bugs, 2026-08-21) — ver comentario de /cazar/explorar arriba.
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    if (Array.isArray(save.pendingCombatNpcSlugs) && save.pendingCombatNpcSlugs.length > 0) {
      return reply.status(400).send({ error: 'Ya hay un combate en curso — resuélvelo antes de salir a cazar.' });
    }
    // Bug real jugando en vivo (2026-08-25): el guard de arriba mira `pendingCombatNpcSlugs`, que
    // solo se actualiza al FINAL de `narrateAndPersistTurn` — si ese turno revienta antes de llegar
    // ahí (p. ej. el narrador de combate múltiple tarda más que el timeout de la transacción de
    // Prisma), el `CombatEncounter` ya quedó creado en la DB pero `pendingCombatNpcSlugs` nunca se
    // puso al día. Reintentar "cazar" en ese estado creaba un SEGUNDO `CombatEncounter` completo,
    // dejando el anterior huérfano en EN_CURSO para siempre — y con dos o más encuentros activos a
    // la vez, cualquier turno futuro (aunque no tenga nada que ver con combate) se enruta sin querer
    // al primero que `findFirst` encuentre. Comprobado aparte, directo contra `CombatEncounter`.
    const activeEncounter = await prisma.combatEncounter.findFirst({ where: { saveId: save.id, estado: 'EN_CURSO', jugable: true } });
    if (activeEncounter) {
      return reply.status(400).send({ error: 'Ya hay un combate en curso — resuélvelo antes de salir a cazar.' });
    }

    const region = save.currentLocation?.region ?? null;
    const uniqueSlugs = [...new Set(slugs)];
    const currentLocationIdForCooldown = save.currentLocation?.id ?? null;
    const fictionalMinutesActuales = save.worldState?.fictionalMinutes ?? 0;
    const candidates = await candidateFaunaFor(
      save.worldId,
      region,
      save.level,
      save.currentLocation?.slug ?? null,
      currentLocationIdForCooldown,
      fictionalMinutesActuales,
    );
    const selected = uniqueSlugs
      .map((slug) => candidates.find((c) => c.slug === slug))
      .filter((c): c is HuntCandidate => !!c);
    if (selected.length === 0) {
      return reply.status(400).send({ error: 'Esa fauna ya no está disponible aquí — puede que se te haya adelantado.' });
    }

    // Servicio reutilizable (Fase 2, 2026-09-28, `plan-mecanicas-por-zona-2026-09-28.md`) — todo lo
    // que decidía "caza limpia o combate" vive ahora en `services/caza.ts` (también usado por
    // `POST /saves/:id/zona/cazar` y por el agresivo en grupo de `dynamicMode.ts`), sin cambiar el
    // comportamiento observable de esta ruta. `Npc` de catálogo completo (atributos, temperamento,
    // `levelMax`...) resuelto en UNA sola consulta para todas las especies seleccionadas — mismo
    // criterio que ya usaba el bloque de combate en grupo, ahora también cubre la caza limpia (que
    // antes hacía su propio `npc.findUnique` aparte).
    const npcsBySlug = new Map((await prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: selected.map((c) => c.slug) } } })).map((n) => [n.slug, n]));
    // Solo con UNA presa seleccionada el `Npc` que falte es un 400 explícito (mismo mensaje que
    // antes) — con varias, una especie sin fila de catálogo simplemente se descarta en silencio
    // (comportamiento previo: el bloque de combate en grupo hacía `if (!npc) continue`).
    if (selected.length === 1 && !npcsBySlug.get(selected[0].slug)) {
      return reply.status(400).send({ error: 'Esa fauna ya no está disponible aquí.' });
    }
    const targets: CazaTarget[] = [];
    for (const c of selected) {
      const npc = npcsBySlug.get(c.slug);
      if (!npc) continue;
      targets.push({ npc, cantidadObjetivo: avistadosFor(c.capturablePct, c.poblacion), cantidadElegida: cantidades?.[c.slug] });
    }

    const resultado = await iniciarCaza({
      save: {
        id: save.id,
        worldId: save.worldId,
        characterName: save.characterName,
        level: save.level,
        attributes: save.attributes as AttributeBlock,
        currentLocationId: save.currentLocation?.id ?? null,
        region,
        fictionalMinutes: fictionalMinutesActuales,
      },
      targets,
    });
    if ('error' in resultado) return reply.status(resultado.status).send({ error: resultado.error });
    return resultado;
  });
}
