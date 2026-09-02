import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { decrementPopulationOnDeath, stripRegionArticle } from '../../services/population.js';
import { pasaFiltroTerreno } from '../../services/terrain.js';
import { locationTerrainTags, faunaTerrainTag } from '../../scripts/worldCatalog.js';
import { scopeFor, pickAmbientEncounterCandidate, difficultyHintFor } from '../../services/npcScene.js';
import { detectHarvestSourcesInScene } from '../../services/harvest.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';
import type { AttributeBlock } from '../../services/dice.js';
import { iniciarCombatEncounter, resolverTurnosAutonomosHastaJugadora, type CombatienteInicial } from '../../services/combateMultipleOrquestacion.js';
import { MAX_COMBATIENTES_POR_BANDO } from '../../services/combateMultiple.js';
import { rejectIfEnded, lockRowForUpdate } from './shared.js';
import { advanceFictionalMinutes, formatFictionalDate } from '../../services/worldClock.js';

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

async function candidateFaunaFor(worldId: string, region: string | null, playerLevel: number, locationSlug: string | null): Promise<HuntCandidate[]> {
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
    return pasaFiltroTerreno(locationSlug ? locationTerrainTags[locationSlug] : undefined, faunaTerrainTag[pop.targetSlug]);
  });
  if (withRegion.length === 0) return [];

  const poblacionBySlug = new Map(withRegion.map((p) => [p.targetSlug, p.poblacion]));
  const npcs = await prisma.npc.findMany({
    where: { worldId, slug: { in: withRegion.map((p) => p.targetSlug) } },
    select: { slug: true, name: true, level: true, capturablePct: true },
  });
  return npcs.map((npc) => ({
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

/// Caza en grupo (2026-08-13, petición explícita: "el jugador primero debe marcar contra cuantos
/// quiere combatir... con un calculo determinista puede darse que salgan menos o más de los que
/// marcaste"). Tirada simple 1d6 sobre lo elegido — primera versión de balance, ajustable después
/// con datos reales de partida: 1-2 uno menos (algunos se dispersan/no llegan a comprometerse),
/// 3-4 exactamente lo elegido, 5-6 uno más (el ruido del combate atrae a otro del grupo). Topado a
/// `avistados` por arriba (nunca más de lo que de verdad hay), pero YA NO topado a mínimo 1 por
/// abajo (2026-09-02, decisión explícita de la usuaria: "que narre un intento fallido") — si
/// `cantidadElegida` es 1 y el roll es malo, el resultado puede ser 0: el grupo entero se dispersa
/// antes de comprometerse, intento de caza fallido de verdad, no solo "menos de lo esperado".
export function rollGroupEngagement(cantidadElegida: number, avistados: number, random: () => number = Math.random): number {
  const roll = Math.floor(random() * 6) + 1;
  const delta = roll <= 2 ? -1 : roll >= 5 ? 1 : 0;
  return Math.max(0, Math.min(avistados, cantidadElegida + delta));
}

/// Cláusula determinista para el texto de la acción cuando lo que de verdad se compromete al
/// combate difiere de lo que el jugador marcó (petición explícita, 2026-08-13: "que refleje la
/// intrusión cuando sale más o menos de lo que marcaste... si marcas 2 y solo consigues acorralar
/// a uno" / "arrinconas a una pero otra aparece repentinamente"). Nunca deja que el Narrador
/// decida ni invente el número — esto ya es el hecho resuelto, la prosa libre solo lo viste.
/// `null` si `cantidadReal === cantidadElegida` (nada que aclarar). `cantidadReal === 0`
/// (2026-09-02, "que narre un intento fallido") es un caso propio, distinto de "menos de los
/// marcados" — el grupo entero se dispersa antes de comprometerse, no queda ni uno.
export function groupVarianceClause(cantidadElegida: number, cantidadReal: number): string | null {
  if (cantidadReal === cantidadElegida) return null;
  if (cantidadReal === 0) return 'aunque al final el grupo entero se dispersa antes de que pueda acorralar a ninguno';
  if (cantidadReal > cantidadElegida) {
    const extra = cantidadReal - cantidadElegida;
    return extra === 1
      ? 'aunque al acercarme, otro más se suma de repente, sin previo aviso'
      : `aunque al acercarme, ${extra} más se suman de repente, sin previo aviso`;
  }
  return cantidadReal === 1
    ? 'aunque al final solo consigo acorralar a uno de los que había marcado'
    : `aunque al final solo consigo acorralar a ${cantidadReal} de los que había marcado`;
}

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
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { currentLocation: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const candidates = await candidateFaunaFor(save.worldId, save.currentLocation?.region ?? null, save.level, save.currentLocation?.slug ?? null);
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
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { currentLocation: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    // Bug real (auditoría de bugs, 2026-08-21): a diferencia de /turn/classify y /combat/flee
    // (session.ts), ninguna ruta de caza comprobaba `save.endedAt` — con la partida ya terminada
    // por muerte definitiva (docs/14-combate-y-muerte.md § 4.4), el composer principal queda
    // bloqueado en el frontend, pero el panel de Habilidades/Cazar sigue accesible y permitía
    // seguir cazando (mutando `WorldPopulation`/`NpcState` de verdad) para un personaje que la
    // propia partida ya da por definitivamente muerto.
    if (rejectIfEnded(save, reply)) return;

    const candidates = await candidateFaunaFor(save.worldId, save.currentLocation?.region ?? null, save.level, save.currentLocation?.slug ?? null);
    if (candidates.length === 0) return { candidates: [] };

    const sighted = rollSightings(candidates);
    if (sighted.length === 0) return { candidates: [] };

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
    const candidates = await candidateFaunaFor(save.worldId, region, save.level, save.currentLocation?.slug ?? null);
    const selected = uniqueSlugs
      .map((slug) => candidates.find((c) => c.slug === slug))
      .filter((c): c is HuntCandidate => !!c);
    if (selected.length === 0) {
      return reply.status(400).send({ error: 'Esa fauna ya no está disponible aquí — puede que se te haya adelantado.' });
    }

    // Caza limpia sin combate: solo con una única presa, débil de verdad frente al personaje —
    // cualquier otro caso (varias presas, o una sola pero no lo bastante débil) exige combate real,
    // narrado y abierto por el propio turno normal (ver comentario de cabecera).
    if (selected.length === 1 && selected[0].debil) {
      const npc = await prisma.npc.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: selected[0].slug } } });
      if (!npc) return reply.status(400).send({ error: 'Esa fauna ya no está disponible aquí.' });

      const destreza = (save.attributes as AttributeBlock).destreza;
      const chance = Math.min(CHANCE_CAZA_LIMPIA_TOPE, npc.capturablePct + destreza);
      const exito = Math.random() * 100 < chance;

      if (!exito) {
        return {
          resuelveSinCombate: false,
          exito: false,
          actionText: `Intento cazar a '${npc.name}' de forma sigilosa y limpia, pero fallo — no queda más remedio que enfrentarla en combate.`,
        };
      }

      const currentLocationId = save.currentLocation?.id ?? null;
      const scope = scopeFor(npc.kind, currentLocationId);
      const text = `${save.characterName} caza limpiamente a ${npc.name}, sin darle ninguna opción de reaccionar.`;
      // P3.6 (checklist consolidado 2026-08-27) — el reloj avanza ANTES de fijar timeLabel/
      // fictionalMinutes del log y de condicionFisicaSinceMinutes, mismo criterio que
      // recolectar.ts (el log/estado reflejan el momento DESPUÉS de la acción, no antes).
      const nuevoFictionalMinutes = advanceFictionalMinutes(save.worldState?.fictionalMinutes ?? 480, CAZA_LIMPIA_MINUTOS);
      const timeLabel = formatFictionalDate(nuevoFictionalMinutes);

      // Condición de carrera real (auditoría 2026-09-01): a diferencia de la caza en grupo (más
      // abajo, ya protegida desde 2026-08-25), este camino escribía directo sin releer el estado —
      // doble clic en "cazar" contra la misma presa única disparaba dos transacciones en paralelo,
      // cada una decrementando población y creando su propio LogEntry, duplicando ambos. Mismo
      // patrón exacto que el bloque de grupo: `SELECT ... FOR UPDATE` sobre `Save` + relectura de
      // `pendingCombatNpcSlugs` dentro de la transacción antes de escribir nada — la segunda
      // petición ve ya el resultado de la primera y aborta sin duplicar.
      const logEntry = await prisma.$transaction(async (tx) => {
        const freshSave = await lockRowForUpdate<{ pendingCombatNpcSlugs: string[] }>(tx, 'Save', save.id, ['pendingCombatNpcSlugs']);
        if (freshSave.pendingCombatNpcSlugs.includes(npc.slug)) return null;

        await tx.npcState.upsert({
          where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope } },
          create: { saveId: save.id, npcId: npc.id, scope, condicionFisica: 'MUERTO', condicionFisicaSinceMinutes: nuevoFictionalMinutes },
          update: { condicionFisica: 'MUERTO', condicionFisicaSinceMinutes: nuevoFictionalMinutes },
        });
        await decrementPopulationOnDeath(tx, save.worldId, null, npc.slug, region);
        await tx.worldState.update({ where: { saveId: save.id }, data: { fictionalMinutes: nuevoFictionalMinutes, fictionalDateLabel: timeLabel } });
        const created = await tx.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, fictionalMinutes: nuevoFictionalMinutes, isPlayerAction: false } });
        await tx.save.update({ where: { id: save.id }, data: { pendingCombatNpcSlugs: [npc.slug] } });
        return created;
      });

      if (!logEntry) {
        return reply.status(409).send({ error: 'Ya se está resolviendo una caza contra esta presa — espera un momento.' });
      }

      const sessionFacts = await loadSessionFacts(save.id);
      await appendSessionFacts(save.id, sessionFacts, [text]);
      // Bug real (2026-08-14, mismo hallazgo que en recolectar.ts) — la caza limpia sin combate
      // tampoco pasa por `narrateAndPersistTurn`, así que la presa cazada podía quedar sin
      // desbloquear su ficha de Enciclopedia pese a estar ya nombrada en el texto determinista.
      await recordEntityDiscoveries({ saveId: save.id, worldId: save.worldId, mentionedText: text });

      return {
        resuelveSinCombate: true,
        exito: true,
        combate: { npcs: [{ slug: npc.slug, name: npc.name, condicionFisica: 'MUERTO' as const, saqueado: false, lootedItemNames: [] }] },
        logEntry: { id: logEntry.id, text, timeLabel, createdAt: logEntry.createdAt.toISOString() },
      };
    }

    // Caza en grupo — Grupo 3 § Mundo determinista, Capa 4 (docs/rpgtarkor/mundo-determinista.md,
    // 2026-08-25): disparo real, `iniciarCombatEncounter` en vez del viejo truco `NpcState.groupSize`
    // (varios individuos "resucitando" en la misma fila). Solo se crea un `CombatEncounter` real si
    // AL MENOS una especie seleccionada tiene más de un avistado — con 1 avistado en TODAS, el
    // combate sigue exactamente igual que siempre (detección normal por texto, `resolveCombatExchangePhase`
    // 1v1 clásico), sin tocar nada de este bloque. Si hay un grupo real, TODAS las especies
    // seleccionadas (incluidas las de un solo individuo) entran en el mismo encuentro — nunca mezclar
    // un `CombatEncounter` real con NPC detectados por el sistema viejo en la misma escena.
    const npcsBySlug = new Map((await prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: selected.map((c) => c.slug) } } })).map((n) => [n.slug, n]));
    const currentLocationId = save.currentLocation?.id ?? null;
    const varianceClauses: string[] = [];
    const conAvistados = selected.map((c) => ({ ...c, avistados: avistadosFor(c.capturablePct, c.poblacion) }));
    const hayGrupoReal = conAvistados.some((c) => c.avistados > 1);

    if (hayGrupoReal) {
      const jugadorAttrs = save.attributes as AttributeBlock;
      const combatientes: (CombatienteInicial & { destreza: number; inteligencia: number })[] = [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: jugadorAttrs.destreza, inteligencia: jugadorAttrs.inteligencia },
      ];
      for (const c of conAvistados) {
        const npc = npcsBySlug.get(c.slug);
        if (!npc) continue;
        const npcAttrs = npc.attributes as AttributeBlock;
        const scope = scopeFor(npc.kind, currentLocationId);
        if (c.avistados > 1) {
          const cantidadElegida = Math.max(1, Math.min(c.avistados, Math.round(cantidades?.[c.slug] ?? c.avistados)));
          let cantidadReal = rollGroupEngagement(cantidadElegida, c.avistados);
          // Fallo total solo tiene sentido narrativo si el grupo puede permitirse dispersarse sin
          // pelear (2026-09-02, matiz explícito de la usuaria: "cazar uno agresivo... ese no
          // debería huir a no ser que realmente seas muy superior a él") — un grupo AGRESIVO no se
          // dispersa por las buenas: si el jugador no supera claramente el tope de nivel de la
          // especie (`levelMax`, mismo criterio que "ya lo tiene todo aprendido"), se fuerza el
          // mínimo de 1 de siempre, igual que antes de este cambio.
          if (cantidadReal === 0 && npc.temperamento === 'AGRESIVO' && save.level <= (npc.levelMax ?? npc.level)) {
            cantidadReal = 1;
          }
          for (let i = 0; i < cantidadReal; i++) {
            combatientes.push({ bando: 'ENEMIGO', tipo: 'NPC', npcId: npc.id, npcScope: scope, destreza: npcAttrs.destreza, inteligencia: npcAttrs.inteligencia, esGrupo: true });
          }
          const clause = groupVarianceClause(cantidadElegida, cantidadReal);
          if (clause) varianceClauses.push(`Con '${c.name}', ${clause}.`);
        } else {
          combatientes.push({ bando: 'ENEMIGO', tipo: 'NPC', npcId: npc.id, npcScope: scope, destreza: npcAttrs.destreza, inteligencia: npcAttrs.inteligencia });
        }
      }
      // Sub-partición >4v4 (docs/rpgtarkor/combate-multiple.md § 3, "Tope duro: 4 combatientes por
      // bando"; checklist 2026-09-01: la función `particionarEnSubCombates` existía desde
      // 2026-08-28 pero nunca se enganchó a este flujo real — un grupo de 5+ creaba un único
      // `CombatEncounter` con TODOS dentro, sin ningún tope). El bando ENEMIGO es el único que
      // puede superar el tope aquí (JUGADOR es siempre 1 en esta ruta) — se parte en fragmentos de
      // `MAX_COMBATIENTES_POR_BANDO`; el jugador se enfrenta en directo solo al primer fragmento
      // (`jugable: true`, mismo flujo de siempre), el resto se crea como `CombatEncounter`
      // `jugable: false` y se resuelve de una sentada nada más terminar la transacción (§ 4 del
      // doc, "combates sin ti presente... misma mecánica exacta, sin interacción en directo").
      const [jugador, ...enemigos] = combatientes;
      const fragmentosEnemigos: typeof enemigos[] = [];
      for (let i = 0; i < enemigos.length; i += MAX_COMBATIENTES_POR_BANDO) {
        fragmentosEnemigos.push(enemigos.slice(i, i + MAX_COMBATIENTES_POR_BANDO));
      }
      const fragmentosParaCrear = fragmentosEnemigos.length > 0 ? fragmentosEnemigos : [[]];

      // Condición de carrera real (auditoría de código 2026-08-25): el guard de arriba (líneas
      // ~246-260) es solo una comprobación temprana — entre esa lectura y este punto hay varias
      // consultas async (`candidateFaunaFor`, `npc.findMany`), tiempo de sobra para que un doble
      // clic en "salgo a cazar" pase el guard dos veces y cree dos `CombatEncounter`. Se relee
      // `activeEncounter` DENTRO de una transacción con la fila de `Save` bloqueada
      // (`SELECT ... FOR UPDATE`, mismo patrón que `progression.ts`/`companeros.ts`) justo antes de
      // crear el encuentro — la segunda petición ve ya el encuentro que dejó la primera.
      const resultado = await prisma.$transaction(async (tx) => {
        await lockRowForUpdate(tx, 'Save', save.id, ['id']);
        const activeEncounterFresco = await tx.combatEncounter.findFirst({ where: { saveId: save.id, estado: 'EN_CURSO', jugable: true } });
        if (activeEncounterFresco) return null;
        await iniciarCombatEncounter(tx, save.id, [jugador, ...fragmentosParaCrear[0]]);
        const autonomosIds: string[] = [];
        for (const fragmento of fragmentosParaCrear.slice(1)) {
          const { encounterId } = await iniciarCombatEncounter(tx, save.id, fragmento, false);
          autonomosIds.push(encounterId);
        }
        return { autonomosIds };
      });
      if (!resultado) {
        return reply.status(400).send({ error: 'Ya hay un combate en curso — resuélvelo antes de salir a cazar.' });
      }

      // Resolución determinista de los sub-combates sin la jugadora presente, de una sentada, sin
      // narrar cada turno individual (decisión explícita 2026-09-01: esos intercambios no se le
      // muestran en directo, narrarlos uno a uno solo suma llamadas a Ollama sin ningún beneficio
      // real) — un resumen corto y determinista basta, mismo criterio que `groupVarianceClause` de
      // arriba (nunca inventado por el modelo).
      let caidosAutonomos = 0;
      for (const encounterId of resultado.autonomosIds) {
        const { caidos } = await resolverTurnosAutonomosHastaJugadora(prisma, save.worldId, save.id, encounterId, [], async () => '');
        caidosAutonomos += caidos.length;
      }
      if (caidosAutonomos > 0) {
        varianceClauses.push(`El resto de la manada, fuera del alcance directo de ${save.characterName}, se enfrenta entre sí y con el terreno — ${caidosAutonomos} caen sin que ${save.characterName} llegue a verlo.`);
      }
    }

    const names = selected.map((c) => c.name);
    const actionText = [`Salgo a cazar y ataco a ${names.map((n) => `'${n}'`).join(', ')}.`, ...varianceClauses].join(' ');
    return { resuelveSinCombate: false, exito: null, actionText };
  });
}
