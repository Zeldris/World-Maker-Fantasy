import type { FastifyInstance } from 'fastify';
import { classifyAction, type ClassificationResult } from '../services/narrador.js';
import { rollCheck } from '../services/dice.js';
import type { AttributeBlock, RollResult } from '../services/dice.js';
import { computeDuration, detectsRestIntent, mentionsExplicitDuration } from '../services/timedActions.js';
import { narrateAndPersistTurn } from '../services/turnResolution.js';
import { recordEntityDiscoveries } from '../services/entityDiscovery.js';
import type { PendingNpcAttack } from '../services/combatExchange.js';
import { resolveTravel, bandaForMinutos, segundosRealesPorTramos, type TravelResolution } from '../services/travel.js';
import { pickTravelInterruption } from '../services/travelInterruption.js';
import { pickStationaryInterruption } from '../services/stationaryInterruption.js';
import { effectiveAttributes, effectiveSecondaryAttributes, effectiveDefense, equippedWeaponNames, equippedItemsSummary } from '../services/equipment.js';
import { parseActiveEffects } from '../services/activeEffects.js';
import {
  detectNpcsInScene,
  calibrationLineFor,
  difficultyHintFor,
  detectsAttackIntent,
  detectsDialogueIntent,
  detectsHostileSearchIntent,
  detectsVerbalAcceptanceIntent,
  tabulatedAttackAttribute,
  type NpcInScene,
} from '../services/npcScene.js';
import { detectsSearchIntent } from '../services/discovery.js';
import { normalizeText } from '../services/travel.js';
import { detectsOwnedItemQuote } from '../services/itemReference.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { peekCachedClassify, setCachedClassify, consumeCachedClassify } from '../lib/classifyCache.js';
import { normalizeSecondaryAttributes } from '../services/secondaryAttributes.js';
import { characterSummaryFor } from '../services/characterSummary.js';
import { entornoTemporalFor } from '../services/worldClock.js';
import { loadSessionFacts } from '../services/worldFacts.js';
import { claimTurnInFlight, releaseTurnInFlight } from '../services/turnLock.js';
import {
  detectsUnequippedWeaponClaim,
  wrongWeaponNarrationFor,
  detectsAbsentSceneNpcClaim,
  absentSceneNpcNarrationFor,
  detectsPlayerAnachronism,
  anachronismNarrationFor,
  detectsWrongRegionHarvestClaim,
  wrongRegionHarvestNarrationFor,
  detectsUnknownConstructionClaim,
  unknownConstructionNarrationFor,
  detectsFabricatedNpcClaim,
  fabricatedNpcNarrationFor,
  detectsFabricatedHarvestSourceClaim,
  fabricatedHarvestSourceNarrationFor,
  deterministicActionUnavailableNarrationFor,
  detectsUnknownDestinationClaim,
  unknownDestinationNarrationFor,
  detectsHarvestSkillMisuseClaim,
  harvestSkillMisuseNarrationFor,
} from '../services/playerActionValidation.js';
import { harvestSourceAliases } from '../scripts/worldCatalog.js';
import { detectsPostCombatInteraction } from '../services/postCombatInteraction.js';
import { startEagerTransitResolution } from '../workers/worldTick.js';
import { detectDeterministicCraft, detectsCraftIntent, CRAFTING_RECIPES } from '../services/crafting.js';
import { planDeterministicBuild, detectsBuildIntent, CONSTRUCTION_RECIPES } from '../services/construction.js';

interface ClassifyBody {
  saveId: string;
  action: string;
  enCombate?: boolean;
  /// Solapar classify con el tecleo (roadmap de velocidad, 2026-07-19): true = hace todo el
  /// trabajo caro y lo cachea, pero NO persiste nada (ni LogEntry ni CharacterTransit) — nunca
  /// usar esto para un envío real del jugador.
  preview?: boolean;
  /// Mecánica real de habilidades de clase (checklist 2026-07-21/22, puntos 1-2): id de la
  /// SavedAction que CombatModal.tsx tiene seleccionada, si la hay — cuando resuelve a una con
  /// `preferredAttribute`, ese atributo gana sobre la heurística de palabra clave
  /// (tabulatedAttackAttribute) para decidir con qué se tira.
  savedActionId?: string;
}

interface NarrateBody {
  saveId: string;
  action: string;
  classification: ClassificationResult;
  roll?: RollResult;
  travel?: TravelResolution | null;
  enCombate?: boolean;
  /// Mismo id que en ClassifyBody — turnResolution.ts lo usa para saber si el `effect` de la
  /// habilidad debe gatear REMATE/ATURDIMIENTO/INTIMIDACION/AGUANTE en este turno.
  savedActionId?: string;
  /// Auditoría de rendimiento 2026-07-28 ("rascar segundos"): mismo dato que ya calculó
  /// /turn/classify para ESTA MISMA acción — reenviado tal cual para que narrateAndPersistTurn no
  /// tenga que pagar otra vez el mismo `detectNpcsInScene` (todo el roster de NPCs del mundo +
  /// sus objetos, contra Supabase remoto) que ya se resolvió hace un instante para la misma
  /// escena. Opcional porque worldTick.ts (resolución diferida) sigue calculándolo fresco, sin
  /// pasar por aquí.
  npcsInScene?: NpcInScene[];
  /// Saqueo selectivo (petición explícita, 2026-07-30) — reenviado tal cual a
  /// `narrateAndPersistTurn`, ver el comentario de `lootItemNames` en turnResolution.ts.
  lootItemNames?: string[];
  /// Rediseño de combate (2026-08-09) — reenviado tal cual a `narrateAndPersistTurn`, ver el
  /// comentario de `NarrateAndPersistParams.isItemUse` en turnResolution.ts.
  isItemUse?: boolean;
  /// Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18) — reenviado
  /// tal cual a `narrateAndPersistTurn`, ver el comentario de `NarrateAndPersistParams.healItemUses`
  /// en turnResolution.ts. Mismo criterio que `lootItemNames`: lista ORDENADA (el orden en que la
  /// jugadora los seleccionó SÍ cambia el resultado, ver `applySequentialHeals`, death.ts).
  healItemUses?: { itemId: string; quantity: number }[];
}

interface ClassificationResolution {
  classification: ClassificationResult;
  roll: RollResult | undefined;
  travel: TravelResolution | null;
  npcsInScene: NpcInScene[];
}

/// Deuda técnica (2026-07-30, auditoría técnica: "/turn/classify... ~345 líneas mezclando
/// validación, caché, detección de NPCs, calibración de dificultad, dados y viaje inline").
/// Extrae justo el núcleo real de "clasificar esta acción" — cache hit/miss, viaje por grafo,
/// atajo tabulado de combate (sin Ollama), o `classifyAction` + sus redes de seguridad de banda —
/// dejando en el handler solo validación/persistencia. Mismo criterio que la extracción de
/// `resolveCombatExchangePhase` en turnResolution.ts: función nombrada y aislada, mismo cuerpo
/// exacto, solo con parámetros explícitos en vez de cerrar sobre variables del handler.
async function resolveClassificationForTurn(params: {
  saveId: string;
  action: string;
  enCombate: boolean | undefined;
  savedActionId: string | undefined;
  preview: boolean | undefined;
  worldId: string;
  currentLocationId: string | null;
  level: number;
  attributes: AttributeBlock;
  sessionFacts: string[];
  characterSummary: string;
  /// Ver el mismo campo en NarrateAndPersistParams (turnResolution.ts) — bug real jugando en
  /// vivo (2026-08-04): sin esto, el atajo tabulado calibraba la dificultad contra
  /// `npcsInScene[0]` aunque el jugador ya estuviera enfrentado a otro NPC.
  pendingCombatNpcSlugs: string[];
  /// Bug real jugando en vivo (2026-08-07, auditoría "revisa la partida" en directo): un NPC ya
  /// ganó la iniciativa y tiene un ataque decidido en secreto (`Save.pendingNpcAttack`) — la
  /// respuesta del jugador a ESO es SIEMPRE una defensa a ciegas que necesita tirada de verdad
  /// (turnResolution.ts ya asume esto: sin `requiereTirada`, descarta el intercambio entero y dejx
  /// el ataque pendiente intacto para el turno siguiente). Sin este dato aquí, texto libre de
  /// defensa sin pulsar el botón de Esquivar/Defenderse (sin `savedActionId`, así que sin
  /// `preferredAttribute` tampoco) caía en `classifyAction` (el LLM), que podía decidir "no hace
  /// falta tirada" para una esquiva clarísima — el combate se congelaba sin tirar dados mientras
  /// la narración libre igualmente inventaba un cambio de salud sin respaldo mecánico ninguno.
  pendingNpcAttack: PendingNpcAttack | null;
  /// Fauna diurna/nocturna real (2026-09-02) — ver el mismo campo en `detectNpcsInScene`
  /// (npcScene.ts).
  fictionalMinutes: number;
}): Promise<ClassificationResolution> {
  const { saveId, action, enCombate, savedActionId, preview, worldId, currentLocationId, level, attributes, sessionFacts, characterSummary, pendingCombatNpcSlugs, pendingNpcAttack, fictionalMinutes } = params;

  // Solapar classify con el tecleo (roadmap de velocidad, 2026-07-19): si un `preview:true`
  // anterior con este MISMO texto exacto ya hizo el trabajo caro, se reutiliza sin repetirlo
  // (Ollama/tabla) — un envío real siempre lo consume (una sola vez, ver consumeCachedClassify)
  // antes de persistir nada, para que una repetición futura del mismo texto tenga su propia
  // tirada, no la de esta vez.
  const cached = peekCachedClassify(saveId, enCombate, action);

  let classification: ClassificationResult;
  let roll: RollResult | undefined;
  let travel: TravelResolution | null;
  let npcsInScene: NpcInScene[];

  if (cached) {
    classification = cached.classification;
    roll = cached.roll;
    travel = cached.travel ?? null;
    npcsInScene = cached.npcsInScene ?? [];
  } else {
    // Se calcula ANTES del viaje (bug real, 2026-07-23, "revisar partida" — ver comentario de
    // abajo): decidir si esto es un viaje necesita saber ya si hay un NPC delante.
    npcsInScene = await detectNpcsInScene({ action, worldId, sessionFacts, saveId, currentLocationId, fictionalMinutes });

    // Viaje por el grafo de ubicaciones (docs/12-mundo-estructurado.md § 1.4): el modelo nunca
    // elige la ruta — si el matcher determinista resuelve un destino conocido, la banda y la
    // duración las decide Dijkstra, no el clasificador, y el viaje no requiere tirada (v1).
    // No aplica dentro de combate (enCombate): un intercambio de combate nunca es un viaje.
    //
    // Bug real (2026-07-23): "Me acerco a la orca y le digo: 'Soy Gorhorn Maktor, quien eres y
    // que buscas?'" activó `detectsTravelIntent` ("me acerco a") y `matchDestination` coincidió
    // con "maktor" (alias de "Los Restos de Maktor") SOLO porque Gorhorn menciona su propio
    // apellido/clan al presentarse — el jugador acabó "viajando" 290 min a las ruinas de su
    // clan en mitad de una conversación con alguien delante suyo. Hablar con un NPC ya en
    // escena nunca es un viaje, sin importar qué palabra coincida por casualidad con un alias
    // de destino — se salta `resolveTravel` por completo en ese caso.
    travel =
      enCombate || (detectsDialogueIntent(action) && npcsInScene.length > 0)
        ? null
        : await resolveTravel({ action, worldId, currentLocationId, attributes });

    if (travel) {
      classification = {
        requiereTirada: false,
        atributo: 'destreza',
        dificultad: 8,
        razon: `Viaje conocido por el camino hacia ${travel.toLocationName} — no requiere tirada.`,
        banda: travel.banda,
        duracionEstimadaMinutos: travel.minutos,
      };
    } else {
      // Mecánica real de habilidades de clase (checklist 2026-07-21/22, puntos 1-2): si
      // CombatModal.tsx mandó savedActionId, su `preferredAttribute` GANA sobre la heurística
      // de palabra clave (tabulatedAttackAttribute) — determinista, no depende de que el
      // promptText de la habilidad contenga la palabra "exacta" que el regex espera.
      // `saveId` en el filtro (auditoría de deuda técnica 2026-08-04, bug real de fuga entre
      // partidas): sin él, cualquier `savedActionId` de OTRA partida seguía resolviendo — un id
      // adivinado o reutilizado por error de una habilidad ajena podía prestar su
      // efecto/atributo preferido a un personaje que nunca la desbloqueó de verdad.
      const selectedAbility = savedActionId
        ? await prisma.savedAction.findFirst({ where: { id: savedActionId, saveId }, select: { effects: true, preferredAttribute: true } })
        : null;
      // Paleta de verbos + clasificación tabulada (roadmap de velocidad, 2026-07-19, prioridad 2):
      // un ataque dentro del popup de combate contra un NPC ya en escena es 100% determinista
      // (mismo dato que difficultyHintFor ya le chequea al clasificador pequeño) — saltarse
      // classifyAction aquí ahorra una llamada entera a Ollama (25-50s) en el turno más repetido
      // de una pelea, sin perder fiabilidad (la tabla no puede "olvidar" ni alucinar el número).
      // Amplía la condición original (solo detectsAttackIntent) a "o hay una habilidad de clase
      // con efecto seleccionada" — una habilidad como Embestida ("cargo con todo mi peso
      // contra...") no siempre encaja en el regex de ataque, pero sigue siendo 100% determinista.
      // Bug real (auditoría 2026-07-23/24, mismo patrón que turnResolution.ts): esto siempre
      // tabulaba contra el primer NPC detectado en escena sin mirar a quién señalaba de verdad
      // la acción — con un aliado o fauna de paso delante del enemigo real, la dificultad de la
      // tirada se calculaba con el nivel equivocado. CombatModal.tsx/los enlaces "pelear con 'X'"
      // siempre citan el nombre real entre comillas simples; si matchea a alguien en escena,
      // manda sobre el orden de detección.
      const quotedTargetMatch = action.match(/'([^']+)'/);
      const explicitTarget = quotedTargetMatch
        ? (npcsInScene.find((n) => normalizeText(n.name) === normalizeText(quotedTargetMatch[1])) ?? null)
        : null;
      // Extendido fuera de combate (auditoría 2026-07-24, "revisa todo bien bien" — clasificación
      // determinista antes de Ollama, no solo corrección después): "Busco combatir contra el Orco
      // Enfurecido" ya tenía una red de seguridad que forzaba banda "instantanea" DESPUÉS de
      // pagar la llamada entera a `classifyAction` — pero la intención hostil declarada contra un
      // NPC ya en escena es tan determinista como un ataque dentro de combate (mismo
      // `difficultyHintFor`), así que se salta Ollama del todo, no solo se corrige después.
      //
      // `!detectsVerbalAcceptanceIntent` (bug real jugando en vivo, 2026-07-24): "Cuenta conmigo.
      // Acabaré con el que te persigue." (aceptar ayudar a Gistera Koh) también matchea
      // `detectsHostileSearchIntent` — tabularlo como ataque contra el primer NPC en escena
      // (Múrgol, sin relación ninguna) no tiene sentido para una promesa a futuro. Cae a
      // `classifyAction` normal; la red de seguridad de banda de más abajo sigue forzando
      // "instantanea" igual, solo que después de una llamada a Ollama en vez de saltársela.
      // Mismo criterio que `ongoingCombatTarget` en turnResolution.ts (bug real, 2026-08-04): un
      // ataque de seguimiento sin nombre citado prefiere a quien el jugador ya estaba enfrentando
      // antes de caer a `npcsInScene[0]`, que puede ser un NPC solo mencionado de pasada en un
      // hecho de trasfondo.
      const ongoingCombatTarget = pendingCombatNpcSlugs.length
        ? (npcsInScene.find((n) => pendingCombatNpcSlugs.includes(n.slug)) ?? null)
        : null;
      // `!!pendingNpcAttack` (bug real 2026-08-07, ver comentario del parámetro arriba): con un
      // ataque de NPC ya decidido en secreto, CUALQUIER respuesta del jugador es su defensa a
      // ciegas — nunca "no hace falta tirada", sin importar si el texto libre suena a ataque, a
      // esquiva o a cualquier otra cosa. Mismo criterio que el resto de este bloque: determinista,
      // no depende de que la LLM lo adivine bien.
      const tabulatedTarget =
        npcsInScene.length > 0 &&
        ((enCombate && (detectsAttackIntent(action) || !!selectedAbility?.effects?.length || !!pendingNpcAttack)) ||
          (!enCombate && detectsHostileSearchIntent(action) && !detectsVerbalAcceptanceIntent(action)))
          ? (explicitTarget ?? ongoingCombatTarget ?? npcsInScene[0])
          : null;
      if (tabulatedTarget) {
        const { dificultad } = difficultyHintFor(tabulatedTarget.level, level);
        classification = {
          requiereTirada: true,
          atributo: (selectedAbility?.preferredAttribute as ClassificationResult['atributo']) ?? tabulatedAttackAttribute(action),
          dificultad,
          razon: `Ataque directo o intención hostil declarada contra ${tabulatedTarget.name} — clasificado por tabla, sin llamada a Ollama.`,
          banda: 'instantanea',
          duracionEstimadaMinutos: 0,
        };
      } else {
        const npcCalibration = calibrationLineFor(npcsInScene, level);
        classification = await classifyAction({ characterSummary, action, npcCalibration });

        // Roadmap 2026-07-20 (Fable, control de acciones — bug real jugando: "Explorar la zona
        // en busca de..." clasificado como banda "larga"/4320 min, 3 días, dejó a la jugadora
        // atascada ~3,6h reales). Red de seguridad sobre el NÚMERO, no solo la etiqueta: una
        // acción de explorar/buscar o descansar SIN duración explícita del jugador no debería
        // durar más de una hora de ficción — si el clasificador devuelve más, se capa antes de
        // derivar banda. `console.warn` para medir cuántas veces sigue haciendo falta.
        if (
          (detectsSearchIntent(action) || detectsRestIntent(action)) &&
          !mentionsExplicitDuration(action) &&
          classification.duracionEstimadaMinutos > 60
        ) {
          console.warn(
            `[clasificador] duración sospechosa (${classification.duracionEstimadaMinutos} min) para "${action}" sin duración explícita — capada a 60.`,
          );
          classification.duracionEstimadaMinutos = 60;
        }

        // Roadmap 2026-07-21 (bug real jugando): un ataque fuera del popup de combate — sin
        // `enCombate`, no pasa por el camino tabulado de arriba — sigue yendo al clasificador
        // pequeño, que puede (y lo hizo, comprobado en vivo) devolver banda "extendida"/"larga"
        // para un claro "cargo contra mi enemigo... contra un Aullador Rojo". Las propias reglas
        // del clasificador dicen que atacar es SIEMPRE instantáneo (ver fixedInstructions en
        // narrador.ts) — un ataque nunca debería crear un CharacterTransit de minutos/horas
        // reales de espera. Se fuerza aquí, antes de derivar banda por minutos, igual que ya se
        // hace con buscar/descansar.
        if (detectsAttackIntent(action) && classification.banda !== 'instantanea') {
          console.warn(
            `[clasificador] ataque clasificado como banda "${classification.banda}"/${classification.duracionEstimadaMinutos}min para "${action}" — forzado a instantánea.`,
          );
          classification.banda = 'instantanea';
          classification.duracionEstimadaMinutos = 0;
        }

        // Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida"):
        // "Soy Gorhorn Maktor, quien eres y que buscas?" (una pregunta/saludo a un NPC ya en
        // escena) se clasificó como banda "extendida"/60 min con tirada de Destreza, dejando al
        // jugador atascado en un CharacterTransit real esperando una respuesta que no llegaba
        // hasta un turno futuro — el clasificador leyó una simple pregunta como "acción directa
        // contra un personaje de nivel superior". Mismo patrón que el ataque de arriba: las
        // propias reglas del clasificador ya dicen que hablar es instantáneo, esto es la red de
        // seguridad determinista para cuando el modelo pequeño no lo respeta.
        if (detectsDialogueIntent(action) && classification.banda !== 'instantanea') {
          console.warn(
            `[clasificador] diálogo clasificado como banda "${classification.banda}"/${classification.duracionEstimadaMinutos}min para "${action}" — forzado a instantánea.`,
          );
          classification.banda = 'instantanea';
          classification.duracionEstimadaMinutos = 0;
        }

        // Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida"):
        // "Busco combatir contra el 'Orco Enfurecido'" (una declaración clara de intención de
        // pelear, sin verbo de ataque literal como "atacar") se clasificó como banda "extendida"
        // — el jugador quedó atascado esperando en vez de entrar en combate. Mismo patrón que
        // el ataque/diálogo de arriba: `detectsHostileSearchIntent` ya existía para decidir si
        // forzar `combateIniciado`, pero no estaba conectado a esta red de seguridad de banda.
        if (detectsHostileSearchIntent(action) && classification.banda !== 'instantanea') {
          console.warn(
            `[clasificador] intención de combate clasificada como banda "${classification.banda}"/${classification.duracionEstimadaMinutos}min para "${action}" — forzado a instantánea.`,
          );
          classification.banda = 'instantanea';
          classification.duracionEstimadaMinutos = 0;
        }

        // Bug real encontrado revisando la partida (2026-07-30, "revisar partida" + queja
        // explícita de la usuaria: "yo me ocupo de el porque deberia ser una accion tan
        // larga?"): "Yo me ocupo de él, no te preocupes" (una promesa/aceptación verbal, sin
        // vocabulario hostil como "acabar con"/"enfrent") se clasificó como banda "larga" —
        // varios minutos reales de espera por una simple frase hablada. La red de seguridad de
        // arriba (`detectsHostileSearchIntent`) solo atrapa promesas que COMPARTEN vocabulario
        // hostil por casualidad ("Acabaré con...", "Me encargaré de acabar con..."); una promesa
        // que use otro verbo (ocuparse, encargarse a secas...) no tenía ninguna red que la
        // forzara a instantánea. Una promesa/aceptación es solo hablar — igual que
        // `detectsDialogueIntent` de arriba, nunca debería crear un CharacterTransit real. Los
        // minutos/horas reales de espera se reservan para viajes largos o tareas que de verdad
        // consumen tiempo narrado, nunca para un compromiso verbal corto.
        if (detectsVerbalAcceptanceIntent(action) && classification.banda !== 'instantanea') {
          console.warn(
            `[clasificador] promesa/aceptación verbal clasificada como banda "${classification.banda}"/${classification.duracionEstimadaMinutos}min para "${action}" — forzada a instantánea.`,
          );
          classification.banda = 'instantanea';
          classification.duracionEstimadaMinutos = 0;
        }

        // Bug real (auditoría 2026-07-30, "revisar partida" — jugando en vivo: "Cosumo 'Raciones
        // de viaje (5 días)'" se clasificó como banda "larga", casi una hora de espera real por
        // comer): el clasificador pequeño puede leer cualquier número/palabra suelta del propio
        // NOMBRE de un objeto (el "(5 días)") como si fuera la duración de la acción. Citar el
        // nombre EXACTO de un objeto que el personaje ya lleva encima, entre comillas simples
        // (mismo patrón que `explicitTarget` para NPCs objetivo), es señal suficiente por sí sola:
        // usar/consultar/consumir algo propio nunca debería crear un `CharacterTransit` real de
        // minutos/horas. Solo consulta el inventario (`action.includes("'")`) cuando de verdad hay
        // algo citado — evita el viaje extra a Supabase en el caso común sin comillas.
        if (classification.banda !== 'instantanea' && action.includes("'")) {
          const inventoryNames = await prisma.inventoryItem.findMany({ where: { saveId }, select: { name: true } });
          if (detectsOwnedItemQuote(action, inventoryNames.map((i) => i.name))) {
            console.warn(
              `[clasificador] uso de objeto propio clasificado como banda "${classification.banda}"/${classification.duracionEstimadaMinutos}min para "${action}" — forzado a instantánea.`,
            );
            classification.banda = 'instantanea';
            classification.duracionEstimadaMinutos = 0;
          }
        }

        // Bug real (auditoría 2026-07-28): dentro del popup de combate, una acción sin verbo de
        // ataque literal ni savedActionId con efecto (una defensa a ciegas o una huida escritas
        // a mano) no pasa por el atajo tabulado ni por ninguno de los 3 regex de arriba —
        // `classifyAction` no recibe ninguna señal de que esto es combate, así que puede devolver
        // banda "extendida"/"larga" igual que le pasaba al ataque/diálogo/intención hostil antes
        // de sus propias redes de seguridad. Eso creaba un CharacterTransit real (turn.ts, rama de
        // arriba) mientras `submitCombatAction` (GameView.tsx) llamaba igualmente a /turn/narrate
        // sin comprobarlo — el turno se resolvía dos veces (ahora y otra vez al vencer ese
        // transit fantasma), y la segunda resolución (worldTick.ts) pierde `enCombate`/
        // `savedActionId`/`pendingNpcAttack` por completo (no viajan en `CharacterTransit.
        // zoneContext`), borrando en silencio cualquier ataque de NPC pendiente de defender.
        // Ningún turno de combate debe crear nunca un transit real de minutos/horas de espera.
        if (enCombate && classification.banda !== 'instantanea') {
          console.warn(
            `[clasificador] acción de combate clasificada como banda "${classification.banda}"/${classification.duracionEstimadaMinutos}min para "${action}" — forzada a instantánea.`,
          );
          classification.banda = 'instantanea';
          classification.duracionEstimadaMinutos = 0;
        }

        // Roadmap 2026-07-19 (clamp de banda): la fiabilidad de "banda" del clasificador pequeño
        // seguía sin validarse (docs/11 § 1.4) — en vez de confiar en que el modelo mantenga
        // banda↔duracionEstimadaMinutos coherentes, se deriva de forma determinista con la MISMA
        // función que ya usa el viaje por grafo (bandaForMinutos). "instantanea" se respeta tal
        // cual (es la única banda sin minutos reales que reconciliar).
        if (classification.banda !== 'instantanea') {
          classification.banda = bandaForMinutos(classification.duracionEstimadaMinutos);
        }
      }
      roll = classification.requiereTirada ? rollCheck(attributes, classification.atributo, classification.dificultad) : undefined;
    }

    if (preview) setCachedClassify(saveId, enCombate, action, { classification, roll, travel, npcsInScene });
  }

  if (!preview) consumeCachedClassify(saveId, enCombate, action);

  return { classification, roll, travel, npcsInScene };
}

/// Turno de juego, en dos pasos (docs/08-acciones-por-tiempo.md): `/turn/classify` es rápido
/// (~25s, sin IA de narración) y `/turn/narrate` es el paso lento (30-220s). Separarlos permite
/// que el frontend muestre un contador visual real con la duración de la acción mientras narrar
/// corre de fondo, y que las bandas extendida/larga respondan casi al instante sin esperar nunca
/// el coste de narrar — el resultado se genera en diferido vía `CharacterTransit` (worldTick).
export async function turnRoutes(app: FastifyInstance) {
  app.post<{ Body: ClassifyBody }>('/turn/classify', async (request, reply) => {
    const { saveId, action, enCombate, preview, savedActionId } = request.body;
    if (!saveId || !action) {
      return reply.status(400).send({ error: 'Faltan campos: saveId, action' });
    }

    const save = await prisma.save.findUnique({
      where: { id: saveId },
      include: {
        characterTransit: true,
        worldState: true,
        inventoryItems: { where: { slot: { not: null } } },
      },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    // docs/14-combate-y-muerte.md § 4.4: partida cerrada por muerte definitiva — no hay más
    // turnos hasta que se reinicia (mismo patrón 409 que un CharacterTransit ocupado).
    if (save.endedAt) {
      return reply.status(409).send({ error: 'Esta partida ha terminado', endedAt: save.endedAt });
    }

    // Muerte permanente, botón Aceptar/Reintentar (2026-08-31, petición explícita) — el susurro de
    // la Entidad ya se narró, pero el respawn/reinicio real está pendiente de
    // POST /saves/:id/death/resolve. Ningún turno normal puede correr mientras tanto (mismo
    // criterio que `endedAt`) — solo rutas de solo lectura (Enciclopedia, world.ts) siguen
    // disponibles, porque nunca pasan por aquí.
    if (save.pendingDeathResolution) {
      return reply.status(409).send({ error: 'Tienes una muerte pendiente de resolver', pendingDeathResolution: true });
    }

    if (save.characterTransit && save.characterTransit.busyUntil > new Date()) {
      return reply.status(409).send({
        error: 'El personaje sigue ocupado',
        activity: save.characterTransit.activity,
        busyUntil: save.characterTransit.busyUntil,
        duracionMinutos: (save.characterTransit.zoneContext as { duracionMinutos?: number } | null)?.duracionMinutos ?? null,
      });
    }

    // Validador de "grounding" de la acción del jugador (Fase 0/1, docs/18-validacion-accion-
    // jugador.md) — corre ANTES de la primera llamada a IA (classifyAction, más abajo). Si
    // dispara, el turno se resuelve aquí mismo con una frase determinista en la voz del
    // personaje, sin gastar ni un segundo de generación. `blocked` es nuevo en
    // `ClassifyResponse` — el frontend, al verlo, se salta `/turn/narrate` por completo (mismo
    // patrón que ya usa `transit`).
    const blockedTimeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
    const blockedFictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
    const blockedWorldId = save.worldId;
    // `discoverEntities` (bug real jugando en vivo, 2026-09-03, "fauna interactuada no se
    // desbloquea en la Enciclopedia"): a diferencia del flujo normal de turno (turnResolution.ts,
    // que sí llama a recordEntityDiscoveries al final), este camino corto nunca lo hacía. Pero solo
    // tiene sentido cuando el guard que bloqueó de verdad menciona una entidad REAL de catálogo
    // (p.ej. `absentSceneNpcClaim` — "¿Kirelon Arenoso? Aquí no hay nadie con ese nombre..."). Los
    // guards puramente sintácticos (anacronismo, construcción inventada) están documentados y
    // testeados como "sin consultas, el chequeo más barato de todos" — llamar aquí siempre habría
    // roto esa garantía para casos donde no hay ninguna entidad real que descubrir.
    async function resolveBlockedTurn(
      narrationText: string,
      discoverName?: string,
      harvestSuggestion?: { oficio: string; abilityLabel: string; highlightSourceSlug: string },
    ) {
      await prisma.logEntry.create({
        data: { saveId, channel: 'CHARACTER', text: action, isPlayerAction: true, timeLabel: blockedTimeLabel, fictionalMinutes: blockedFictionalMinutes },
      });
      await prisma.logEntry.create({
        data: { saveId, channel: 'CHARACTER', text: narrationText, isPlayerAction: false, timeLabel: blockedTimeLabel, fictionalMinutes: blockedFictionalMinutes },
      });
      // `discoverName` (bug real jugando en vivo, 2026-09-03, "fauna interactuada no se
      // desbloquea en la Enciclopedia" — corregido de nuevo tras un flake real: `ABSENT_NPC_LINES`
      // es un pool de 5 frases, 2 de las 5 son genéricas y NO mencionan el nombre real, así que
      // escanear `narrationText` fallaba de forma intermitente ~40% de las veces). Se pasa el
      // nombre real de forma determinista desde el call-site (`absentNpcClaim.name`), sin depender
      // de qué frase salió al azar.
      if (discoverName) {
        await recordEntityDiscoveries({ saveId, worldId: blockedWorldId, mentionedText: discoverName });
      }
      // `harvestSuggestion` (Pieza 6d, 2026-09-03): botón real en el log (frontend) que abre el
      // modal de recolección correcto con la fuente citada priorizada — efímero a propósito, igual
      // que `questOffer`/`dynamicModeOffer` (nunca se persiste en `LogEntry`, solo viaja en la
      // respuesta HTTP de este turno).
      return { blocked: { narration: narrationText, harvestSuggestion } };
    }

    // Anacronismo en el propio texto del jugador ("me monto en mi nave espacial") — el chequeo
    // más barato de todos (regex plano, sin consultas), va primero.
    if (detectsPlayerAnachronism(action)) {
      return resolveBlockedTurn(anachronismNarrationFor());
    }

    // Tipo de construcción inventado ("construyo una Torre de Cristal") — también puro regex,
    // sin consultas.
    if (detectsUnknownConstructionClaim(action)) {
      return resolveBlockedTurn(unknownConstructionNarrationFor());
    }

    // Arma que no lleva encima ("uso mi lanza" con una maza equipada).
    const weaponClaim = detectsUnequippedWeaponClaim(action, equippedWeaponNames(save.inventoryItems));
    if (weaponClaim) {
      const armaReal = save.inventoryItems.find((i) => i.slot === 'ARMA_PRINCIPAL')?.name ?? equippedWeaponNames(save.inventoryItems)[0];
      return resolveBlockedTurn(wrongWeaponNarrationFor(armaReal));
    }

    // NPC/fauna real de catálogo con el que el jugador interactúa, pero que no está de verdad en
    // esta escena ("existe pero no está aquí"). `sessionFacts` se carga ya aquí (antes se hacía
    // más abajo, junto a `characterSummary`) porque `detectNpcsInScene` también lo necesita —
    // reordenar en vez de duplicar la carga.
    const sessionFacts = await loadSessionFacts(save.id);
    const npcsInSceneForValidation = await detectNpcsInScene({
      action,
      worldId: save.worldId,
      sessionFacts,
      saveId,
      currentLocationId: save.currentLocationId,
      fictionalMinutes: blockedFictionalMinutes,
    });
    const absentNpcClaim = await detectsAbsentSceneNpcClaim(
      action,
      save.worldId,
      npcsInSceneForValidation.map((n) => n.slug),
    );
    if (absentNpcClaim) {
      return resolveBlockedTurn(absentSceneNpcNarrationFor(absentNpcClaim.name), absentNpcClaim.name);
    }

    // Fase 3 (acotada a comillas, docs/18-validacion-accion-jugador.md): NPC/fauna nombrado ENTRE
    // COMILLAS que no existe en absoluto en el catálogo del mundo — a diferencia del chequeo de
    // arriba (existe pero no está en esta escena), aquí no existe en ningún sitio.
    const fabricatedNpcClaim = await detectsFabricatedNpcClaim(action, save.worldId);
    if (fabricatedNpcClaim) {
      return resolveBlockedTurn(fabricatedNpcNarrationFor(fabricatedNpcClaim.quotedName));
    }

    // Fuente de flora/mineral real de OTRA región ("recolecto matorral de cuerno" estando en una
    // región donde no crece). `currentLocationForSummary` se carga ya aquí (antes se hacía más
    // abajo, junto a `characterSummary`) porque este chequeo también necesita la región actual —
    // reordenar en vez de duplicar la carga.
    const currentLocationForSummary = save.currentLocationId
      ? await prisma.location.findUnique({ where: { id: save.currentLocationId } })
      : null;
    const wrongRegionHarvestClaim = detectsWrongRegionHarvestClaim(action, currentLocationForSummary?.region ?? null);
    if (wrongRegionHarvestClaim) {
      const nombre = harvestSourceAliases[wrongRegionHarvestClaim.sourceSlug]?.[0] ?? wrongRegionHarvestClaim.sourceSlug.replace(/-/g, ' ');
      return resolveBlockedTurn(wrongRegionHarvestNarrationFor(nombre));
    }

    // Fase 3 (acotada a comillas): flora/mineral nombrado ENTRE COMILLAS que no existe en
    // absoluto en `harvestSourceAliases` — a diferencia del chequeo de arriba (existe, pero en
    // otra región), aquí la fuente citada no existe en ningún catálogo.
    const fabricatedHarvestSourceClaim = detectsFabricatedHarvestSourceClaim(action);
    if (fabricatedHarvestSourceClaim) {
      return resolveBlockedTurn(fabricatedHarvestSourceNarrationFor(fabricatedHarvestSourceClaim.quotedName));
    }

    // Mundo determinista, el narrador solo narra (Pieza 6d, 2026-09-03): a diferencia de los guards
    // de arriba (fuente inexistente/de otra región), aquí la fuente SÍ existe, SÍ está bien de
    // región, Y el verbo usado es el correcto para su método (MINERIA/TALA/EXTRACCION/PESCA/
    // BUSQUEDA, nunca CAZA) — el problema es que ese texto libre se resolvía por una vía paralela y
    // más fácil que el modal real de la habilidad (tirada genérica del LLM, sin herramienta ni
    // depleción de `WorldPopulation`) — se corta antes y se ofrece un botón real
    // (`harvestSuggestion`) que abre el modal correcto. `!enCombate` (mismo criterio que crafteo/
    // construcción, Pieza 6a/6b): dentro de combate ninguna acción es un intento real de recolectar.
    const harvestSkillMisuseClaim = !enCombate ? await detectsHarvestSkillMisuseClaim(action, save.worldId) : null;
    if (harvestSkillMisuseClaim) {
      return resolveBlockedTurn(harvestSkillMisuseNarrationFor(harvestSkillMisuseClaim.sourceName), undefined, {
        oficio: harvestSkillMisuseClaim.oficio,
        abilityLabel: harvestSkillMisuseClaim.abilityLabel,
        highlightSourceSlug: harvestSkillMisuseClaim.sourceSlug,
      });
    }

    // Mundo determinista, el narrador solo narra (Pieza 6c, 2026-09-03): viaje declarado con verbo
    // inequívoco ("voy a", "me dirijo hacia"...) hacia un destino que no coincide con ningún alias
    // real de ubicación del mundo — antes caía al narrador libre, que podía narrar una salida/
    // llegada a un sitio inventado sin que `Save.currentLocationId` cambiara nunca de verdad.
    // Mismas exclusiones que ya usa `resolveTravel` (turn.ts, más abajo en `resolveClassificationForTurn`):
    // combate nunca es viaje, y "me acerco a X y le digo..." (diálogo con NPC ya en escena) tampoco
    // — sin esto, hablar con alguien delante podría bloquearse por casualidad léxica con "acerco a".
    if (!enCombate && !(detectsDialogueIntent(action) && npcsInSceneForValidation.length > 0) && (await detectsUnknownDestinationClaim(action, save.worldId))) {
      return resolveBlockedTurn(unknownDestinationNarrationFor());
    }

    // Interacción con un NPC/fauna ya convaleciente o muerto, FUERA de combate (docs/19 pieza 2) —
    // no es una violación (no usa `resolveBlockedTurn`, no gasta ningún LogEntry): es un atajo
    // mecánico legítimo. No hay nada nuevo que narrar sobre alguien ya resuelto, así que el turno
    // no llega ni a `classifyAction` — el frontend recibe la ficha y decide Saquear/Decapitar/Salir
    // sin que este intento de interacción cuente como una acción de verdad.
    if (!enCombate) {
      const postCombatTarget = detectsPostCombatInteraction(action, npcsInSceneForValidation);
      if (postCombatTarget) {
        return { postCombatInteraction: postCombatTarget };
      }
    }

    // Estadísticas de objetos (2026-07-19): la tirada usa los atributos EFECTIVOS (base + lo
    // que sume el equipo puesto), nunca los atributos crudos guardados en el personaje.
    const attributes = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
    // Necesarios para el precheck de crafteo determinista de más abajo (`detectDeterministicCraft`
    // espera exactamente los mismos inputs que `canCraft` ya usa dentro de `narrateAndPersistTurn`).
    const secondaryAttributes = effectiveSecondaryAttributes(normalizeSecondaryAttributes(save.secondaryAttributes), save.inventoryItems);
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
    const characterSummary = characterSummaryFor(save, {
      timeLabel,
      locationName: currentLocationForSummary?.name ?? null,
      region: currentLocationForSummary?.region ?? null,
      level: save.level,
      attributes,
      condicionFisica: save.condicionFisica,
      // Clima/estación al narrador (2026-08-27) — ver comentario de `EntornoTemporal.clima`, sigue
      // siendo null si la región no tiene clima real diseñado (solo Las Llanuras hoy).
      entorno: entornoTemporalFor(save.worldState?.fictionalMinutes ?? 0, currentLocationForSummary?.region ?? null, save.raza),
    });

    const { classification, roll, travel, npcsInScene } = await resolveClassificationForTurn({
      saveId,
      action,
      enCombate,
      savedActionId,
      preview,
      worldId: save.worldId,
      currentLocationId: save.currentLocationId,
      level: save.level,
      attributes,
      sessionFacts,
      characterSummary,
      pendingCombatNpcSlugs: (save.pendingCombatNpcSlugs as string[] | null) ?? [],
      pendingNpcAttack: save.pendingNpcAttack as unknown as PendingNpcAttack | null,
      fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
    });

    // Bug real (auditoría en vivo, 2026-09-01): `computeDuration` decide su `produccion` solo por
    // palabras sueltas del texto libre (regex de "leña", sin relación con si la acción es una
    // construcción real) — "Construyo un campamento... usando la leña..." disparaba la regex de
    // leña por la propia palabra en la frase, mostrando aquí (y materializando más abajo, en
    // narrateAndPersistTurn) un "estará ocupado... debería conseguir N de Leña" espurio junto al
    // aviso real de construcción. Mismo chequeo barato (sin I/O) que `mightBeBuildAttempt` más
    // abajo (línea ~692) — se calcula aquí también porque este punto es anterior en el flujo.
    const mightBeBuildAttemptForDuration = CONSTRUCTION_RECIPES.some((r) => detectsBuildIntent(r, action));
    const { minutos, produccion } = travel
      ? { minutos: travel.minutos, produccion: undefined }
      : computeDuration(action, classification.banda, attributes, classification.duracionEstimadaMinutos);
    const produccionFiltrada = mightBeBuildAttemptForDuration ? undefined : produccion;

    if (preview) {
      return {
        classification,
        roll,
        travel,
        duracionMinutos: minutos,
        produccion: produccionFiltrada ? `${produccionFiltrada.cantidad} de ${produccionFiltrada.itemName}` : undefined,
      };
    }

    // Crafteo con espera real (petición explícita, 2026-08-20: "quiero tener para esta parte algo
    // similar a los viajes, que salga que estás crafteando y que lleve un tiempo real con la
    // opción a cancelarlo... entre 5 segs y 60 segs" — antes el crafteo determinista resolvía
    // síncrono en la misma respuesta, y encima esperaba de balde la generación completa del
    // Narrador solo para tirarla, ver `craftMode`/`wasLlmNarrated` en turnResolution.ts). Chequeo
    // barato primero (regex sin consultas, mismo criterio que el resto de detecciones de esta
    // ruta, líneas de arriba) — el inventario completo/catálogo/progreso de oficios solo se pagan
    // si de verdad podría tratarse de un intento de crafteo.
    const mightBeCraftAttempt = CRAFTING_RECIPES.some((recipe) => detectsCraftIntent(recipe, action));
    const craftAttempt = mightBeCraftAttempt
      ? await detectDeterministicCraft({
          action,
          worldId: save.worldId,
          saveId,
          currentLocationSlug: currentLocationForSummary?.slug ?? null,
          inventoryRows: await prisma.inventoryItem.findMany({ where: { saveId }, select: { id: true, name: true, catalogSlug: true } }),
          attributes,
          secondaryAttributes,
          unlockedRecipeKeys: save.unlockedRecipeKeys,
        })
      : null;

    if (craftAttempt) {
      const busyUntil = new Date(Date.now() + craftAttempt.durationSeconds * 1000);
      const startText = `${save.characterName} se pone a preparar ${craftAttempt.resultNames.join(', ')}...`;

      // Mismo desempate de `createdAt` que el bloque de viaje de abajo (bug real, 2026-07-24: sin
      // esto, el orden entre el LogEntry de la acción y el de "se pone a ello" no está garantizado
      // dentro de la misma transacción).
      const playerActionAt = new Date();
      const startTextAt = new Date(playerActionAt.getTime() + 1);
      const [, , transitRow] = await prisma.$transaction([
        prisma.logEntry.create({
          data: {
            saveId,
            channel: 'CHARACTER',
            text: action,
            isPlayerAction: true,
            timeLabel,
            fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
            createdAt: playerActionAt,
          },
        }),
        prisma.logEntry.create({
          data: {
            saveId,
            channel: 'CHARACTER',
            text: startText,
            timeLabel,
            fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
            createdAt: startTextAt,
          },
        }),
        prisma.characterTransit.upsert({
          where: { saveId },
          create: { saveId, activity: action, busyUntil, zoneContext: { action, classification, roll, travel: null } as object },
          update: { activity: action, busyUntil, zoneContext: { action, classification, roll, travel: null } as object },
        }),
        prisma.save.update({ where: { id: saveId }, data: { lastPlayedAt: new Date() } }),
      ]);

      // Reclamo DELIBERADAMENTE retrasado hasta `busyUntil` — a diferencia de viaje (que llama a
      // `startEagerTransitResolution` ya mismo, para solapar la espera con la generación lenta del
      // Narrador): crafteo se la salta entera (`craftMode`, turnResolution.ts), así que no hay nada
      // que precomputar por adelantado. Si se reclamara ya, `POST /transit/cancel` (que se niega en
      // cuanto ve `zoneContext.claimedAt`) quedaría bloqueado durante casi toda la espera real —
      // retrasando la llamada, el jugador puede cancelar mientras "Cancelar acción" siga visible,
      // tal como se pidió. Si el proceso se reinicia antes de que este `setTimeout` dispare, el
      // barrido periódico de `resolveDueTransits` (worldTick.ts) recoge la fila igual en cuanto
      // venza `busyUntil` — mismo colchón de siempre.
      setTimeout(() => {
        void startEagerTransitResolution(transitRow.id, busyUntil).catch((err) =>
          console.error(`[turn] error en la resolución del crafteo diferido ${transitRow.id}:`, err),
        );
      }, craftAttempt.durationSeconds * 1000);

      return { classification, roll, transit: { busyUntil, duracionMinutos: minutos }, travel: null };
    }

    // Mundo determinista, el narrador solo narra (Pieza 6, 2026-09-03): el texto menciona
    // verbo+sustantivo de una receta de crafteo real (`mightBeCraftAttempt`, señal ya fuerte —
    // exige ambos, no un verbo suelto), pero `detectDeterministicCraft` no encontró ninguna receta
    // que se pueda craftear de verdad ahora (sin materiales/ubicación/nivel de oficio/receta
    // desbloqueada) — antes esto caía sin más al narrador libre, que podía narrar un objeto
    // fabricado que nunca se persistía. Mensaje determinista fijo en vez de dejarlo inventar.
    // `!enCombate` (bug real encontrado en la propia suite, "Contraataque..."): en pleno combate,
    // vocabulario de intercambio ("me preparo para responder") puede matchear por casualidad
    // verbo+sustantivo de una receta — dentro de combate ninguna acción es un intento real de
    // craftear, mismo criterio que ya usa el resto de guards de esta ruta (línea ~575).
    if (!enCombate && mightBeCraftAttempt && !craftAttempt) {
      return resolveBlockedTurn(deterministicActionUnavailableNarrationFor());
    }

    // Building.status EN_CONSTRUCCION real (2026-08-23, Grupo 3 § Building.status — ver el
    // comentario de cabecera de `planDeterministicBuild`, construction.ts). A diferencia del
    // crafteo de arriba (transit propio, con su propia espera real corta), construcción SIEMPRE
    // pasa por el tramo genérico de "banda larga" de más abajo — aquí solo se detecta si aplica,
    // para que ese tramo pueda crear la fila de `Building` YA, dentro de la misma transacción que
    // el `CharacterTransit`, en vez de esperar a que la construcción termine de resolverse.
    const mightBeBuildAttempt = CONSTRUCTION_RECIPES.some((r) => detectsBuildIntent(r, action));
    const buildAttempt = mightBeBuildAttempt && currentLocationForSummary
      ? await planDeterministicBuild({
          action,
          worldId: save.worldId,
          saveId,
          currentLocationId: currentLocationForSummary.id,
          activeRegion: currentLocationForSummary.region,
          inventoryRows: await prisma.inventoryItem.findMany({ where: { saveId }, select: { id: true, name: true, catalogSlug: true } }),
          attributes,
          secondaryAttributes,
        })
      : null;

    // Mundo determinista, el narrador solo narra (Pieza 6, 2026-09-03) — mismo criterio que el
    // guard de crafteo de arriba: el texto menciona verbo+sustantivo de una receta de construcción
    // real, pero `planDeterministicBuild` no encontró ninguna que se pueda construir de verdad
    // ahora (sin materiales/ubicación válida/territorio propio). `detectsUnknownConstructionClaim`
    // (más arriba en este archivo) ya cubre el caso "ese tipo de edificio no existe en absoluto" —
    // este cubre el caso distinto "existe, pero no se puede aquí/ahora".
    if (!enCombate && mightBeBuildAttempt && !buildAttempt) {
      return resolveBlockedTurn(deterministicActionUnavailableNarrationFor());
    }

    if (classification.banda === 'extendida' || classification.banda === 'larga') {
      // Eventos de viaje interactivos (2026-08-05, petición explícita: "que las esperas entre los
      // movimientos de zonas sean más dinámicas"): decidido AQUÍ, al iniciar el viaje, no al
      // resolverlo — si algún nodo intermedio de la ruta dispara, el viaje se trunca a ese punto
      // (llegada real, no la del destino pedido) y el candidato elegido entra en escena de verdad
      // en cuanto se resuelva el tránsito (ver turnResolution.ts).
      const interruption = travel
        ? await pickTravelInterruption(save.worldId, travel, env.travelInterruptionProbabilityPerSegment, attributes)
        : null;
      // Grupo 3 § Mundo determinista, Capa 2 (2026-08-25) — generaliza lo de arriba a acciones
      // largas SIN desplazamiento (descansar, construir, crafteo largo que llegue a pasar por aquí):
      // hasta ahora estas quedaban fuera a propósito ("no hay ruta que interrumpir"). Solo puede
      // disparar en zonas con `ZonePoint` real (Capa 1, hoy solo La Hondonada del Eco) — en
      // cualquier otra zona `pickStationaryInterruption` siempre devuelve null, cero efecto.
      const stationaryInterruption =
        !travel && currentLocationForSummary
          ? await pickStationaryInterruption(save.worldId, currentLocationForSummary.id, minutos, env.stationaryInterruptionProbabilityPerChunk)
          : null;
      const effectiveTravel = interruption ? interruption.travel : travel;
      const effectiveMinutos = interruption ? interruption.travel.minutos : minutos;
      // Nombre del destino ORIGINAL pedido por el jugador (antes de truncar) — se guarda aparte
      // porque `effectiveTravel.toLocationName` ya es el de la parada intermedia. Solo sirve para
      // el aviso determinista de "tu viaje se interrumpió" al resolver (turnResolution.ts); el
      // Narrador nunca lo ve, para no forzarlo a explicar un destino al que no llegó.
      const interruptedOriginalDestinationName = interruption ? travel!.toLocationName : null;
      // El mismo campo `travelInterruptionNpcId` sirve para los dos casos — la inyección
      // determinista del NPC en escena (turnResolution.ts) ya cae a `currentLocationId` cuando no
      // hay `travel`, sin necesitar ningún campo nuevo. Lo único que distingue el aviso al
      // resolver es que `interruptedOriginalDestinationName` se queda `null` aquí (no hay destino
      // que truncar en una acción estacionaria).
      const interruptionNpcId = interruption?.npcId ?? stationaryInterruption?.npcId ?? null;

      // Compresión de tiempo (roadmap 2026-07-19): `minutos` es tiempo de FICCIÓN — mapearlo 1:1 a
      // espera real hacía matemáticamente imposible una sesión fluida (un viaje interno normal ya
      // son 83-248 min de ficción con el grafo actual). El reloj ficticio sigue avanzando el total
      // real de `minutos` sin comprimir (ver narrateAndPersistTurn) — solo se comprime la espera.
      // Viaje real (`effectiveTravel` con `segments`): la espera se calcula por NÚMERO de tramos
      // cruzados (segundosRealesPorTramos, travel.ts), no por `minutosBase` acumulado — ver
      // comentario ahí. Cualquier otra acción larga sin desplazamiento (descansar, construir,
      // crafteo largo) sigue con la fórmula vieja de minutos de ficción ÷ divisor.
      const minutosReales = effectiveTravel
        ? segundosRealesPorTramos(effectiveTravel.segments.length, {
            segundosPrimerTramo: env.travelSegundosPrimerTramo,
            segundosPorTramoExtra: env.travelSegundosPorTramoExtra,
            segundosMaximos: env.travelSegundosMaximos,
          }) / 60
        : Math.min(Math.max(1, effectiveMinutos / env.fictionMinutesPerRealMinute), env.transitMaxRealMinutes);
      const busyUntil = new Date(Date.now() + minutosReales * 60_000);
      const produccionLabel = produccionFiltrada ? `${produccionFiltrada.cantidad} de ${produccionFiltrada.itemName}` : undefined;
      const startText = `${save.characterName} se pone a ello: "${action}". Estará ocupado un buen rato${
        produccionLabel ? ` (debería conseguir ${produccionLabel})` : ''
      }.`;

      // Bug real encontrado auditando la partida de Gorhorn (2026-07-24, "revisar mi partida
      // actual"): dentro de una misma transacción, `now()` de Postgres (el default de
      // `createdAt`) devuelve el MISMO instante para las dos filas — sin desempate, el orden entre
      // ambas al leer `orderBy: createdAt asc` no está garantizado, y en la práctica salía al
      // revés (el aviso de "se pone a ello" antes que la propia acción del jugador que lo causó).
      // `createdAt` explícito con +1ms fuerza el orden real sin depender del default compartido.
      const playerActionAt = new Date();
      const startTextAt = new Date(playerActionAt.getTime() + 1);
      // Interactiva en vez de array plano (2026-08-23, Grupo 3 § Building.status) — hace falta
      // poder crear la fila de `Building` EN_CONSTRUCCION condicionalmente (solo si `buildAttempt`)
      // y leer su id antes de montar `zoneContext`, algo que el form-array de siempre no permite
      // limpiamente sin desincronizar posiciones. Misma atomicidad de antes.
      const transitRow = await prisma.$transaction(async (tx) => {
        await tx.logEntry.create({
          data: {
            saveId,
            channel: 'CHARACTER',
            text: action,
            isPlayerAction: true,
            timeLabel,
            fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
            createdAt: playerActionAt,
          },
        });
        await tx.logEntry.create({
          data: {
            saveId,
            channel: 'CHARACTER',
            text: startText,
            timeLabel,
            fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
            createdAt: startTextAt,
          },
        });
        // Building.status EN_CONSTRUCCION real (2026-08-23) — la fila se crea YA, dentro de la
        // misma transacción que el CharacterTransit, en vez de esperar a que la construcción se
        // resuelva del todo (ver comentario de cabecera de `planDeterministicBuild`,
        // construction.ts). Se completa a ACTIVO (o se borra si la construcción falla al
        // resolver por una carrera de última hora) en turnResolution.ts — ver `earlyBuildingId`.
        const earlyBuilding = buildAttempt
          ? await tx.building.create({
              data: {
                saveId,
                locationId: currentLocationForSummary!.id,
                recipeKey: buildAttempt.key,
                name: buildAttempt.name,
                kind: buildAttempt.key,
                description: buildAttempt.description,
                status: 'EN_CONSTRUCCION',
                tier: buildAttempt.ayuntamientoNivel ?? undefined,
              },
            })
          : null;
        const zoneContext = {
          action,
          classification,
          roll,
          travel: effectiveTravel,
          duracionMinutos: effectiveMinutos,
          travelInterruptionNpcId: interruptionNpcId,
          travelInterruptionOriginalDestinationName: interruptedOriginalDestinationName,
          buildingId: earlyBuilding?.id ?? null,
        } as object;
        const transit = await tx.characterTransit.upsert({
          where: { saveId },
          create: { saveId, activity: action, busyUntil, zoneContext },
          update: { activity: action, busyUntil, zoneContext },
        });
        // Retomar viaje truncado (2026-08-28, P3.2): solo se rellena en el momento real de truncar
        // (interruption !== null Y había un travel de verdad, no una acción estacionaria) — un
        // nuevo viaje iniciado normalmente (sin truncar) debe limpiar cualquier resto de un
        // truncamiento anterior que el jugador decidiera abandonar por su cuenta.
        await tx.save.update({
          where: { id: saveId },
          data: {
            lastPlayedAt: new Date(),
            pendingTravelResumeDestinationId: interruption && travel ? travel.toLocationId : null,
          },
        });
        return transit;
      });

      // Espera de viaje precalculada (2026-08-13, petición explícita: "si no hay eventos con las
      // esperas... no hay que esperar los mins y luego lanzar el prompt... el prompt se lanza ya
      // en medio de la espera"). Solo cuando NO hay evento (`interruption === null`): con evento,
      // `pickTravelInterruption` YA truncó `effectiveTravel` a la parada intermedia real — no hay
      // ningún paso posterior de "resolver el evento" que editar, el propio `effectiveTravel` ya
      // lo incorpora — pero se deja la resolución diferida de siempre para ese caso, sin
      // adelantarla, por prudencia (menos margen de sobra si algo del evento cambia entre medias).
      // Fire-and-forget: no bloquea esta respuesta, y cualquier fallo se registra solo, el barrido
      // periódico de `worldTick.ts` reintenta esta misma fila si `narrationClaimedAt` se libera.
      if (!interruption) {
        void startEagerTransitResolution(transitRow.id, busyUntil).catch((err) =>
          console.error(`[turn] error en la resolución anticipada del tránsito ${transitRow.id}:`, err),
        );
      }

      // Petición explícita de la usuaria (2026-07-30): "cuando salgan esas esperas que ponga
      // ej: 7 mins de tiempo real 2 dias en Helek" — sin esto, la espera solo mostraba el
      // tiempo real comprimido, sin ninguna pista de cuánto dura DE VERDAD la acción dentro de
      // la ficción, dejando la pregunta "¿por qué tarda tanto?" sin respuesta visible en la UI.
      return { classification, roll, transit: { busyUntil, duracionMinutos: effectiveMinutos }, travel: effectiveTravel };
    }

    // Instantánea/corta: el jugador verá el turno completo en esta misma sesión — deja ya la
    // acción del jugador en el log para que aparezca de inmediato, antes de esperar a narrar.
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: action, isPlayerAction: true, timeLabel },
    });

    const produccionLabel = produccionFiltrada ? `${produccionFiltrada.cantidad} de ${produccionFiltrada.itemName}` : undefined;
    // Auditoría de rendimiento 2026-07-28 ("rascar segundos"): `npcsInScene` viaja tal cual hasta
    // el frontend para que /turn/narrate lo reciba de vuelta y no tenga que recalcularlo — ver
    // NarrateBody.npcsInScene más abajo y el mismo comentario en turnResolution.ts.
    return { classification, roll, duracionMinutos: minutos, produccion: produccionLabel, travel, npcsInScene };
  });

  app.post<{ Body: NarrateBody }>('/turn/narrate', async (request, reply) => {
    const { saveId, action, classification, roll, travel, enCombate, savedActionId, npcsInScene, lootItemNames, isItemUse, healItemUses } = request.body;
    if (!saveId || !action || !classification) {
      return reply.status(400).send({ error: 'Faltan campos: saveId, action, classification' });
    }

    const save = await prisma.save.findUnique({
      where: { id: saveId },
      include: { world: true, worldState: true, inventoryItems: { where: { slot: { not: null } } } },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    if (save.endedAt) {
      return reply.status(409).send({ error: 'Esta partida ha terminado', endedAt: save.endedAt });
    }

    // Mismo guard que /turn/classify — ver comentario ahí.
    if (save.pendingDeathResolution) {
      return reply.status(409).send({ error: 'Tienes una muerte pendiente de resolver', pendingDeathResolution: true });
    }

    // Candado de turno (auditoría de código completa, 2026-08-07, ver turnLock.ts) — ANTES de
    // cualquier `await` de aquí en adelante, para que dos peticiones casi simultáneas no puedan
    // pasar ambas este chequeo. Mismo código 409 que `busyUntil` en /turn/classify, distinto
    // motivo (aquí es "ya hay una narración en curso para esta partida", no "personaje ocupado
    // tiempo de ficción").
    if (!claimTurnInFlight(saveId)) {
      // `locked: true` (no solo el 409) para que el frontend lo distinga del resto de 409 de este
      // proyecto (`busyUntil`/`endedAt`) — a diferencia de esos, aquí NO hay nada resolviéndose en
      // segundo plano que valga la pena sondear: este turno se rechazó de raíz, nunca llegó a
      // narrar. Tratarlo con el mismo mecanismo de reconexión que un stream cortado a mitad haría
      // que el frontend esperase minutos un resultado que nunca va a llegar.
      return reply.status(409).send({ error: 'Ya hay un turno resolviéndose para esta partida — espera a que termine.', locked: true });
    }

    const sessionFacts = await loadSessionFacts(save.id);
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
    const attributes = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
    const secondaryAttributes = effectiveSecondaryAttributes(normalizeSecondaryAttributes(save.secondaryAttributes), save.inventoryItems);
    const defensa = effectiveDefense(save.inventoryItems);
    const equippedWeapons = equippedWeaponNames(save.inventoryItems);
    const equippedItems = equippedItemsSummary(save.inventoryItems);
    const duration = travel ? null : computeDuration(action, classification.banda, attributes, classification.duracionEstimadaMinutos);
    const minutosDeEsteTurno = travel ? travel.minutos : duration!.minutos;

    // Streaming (roadmap de velocidad, 2026-07-20, punto 13): NDJSON, una línea por evento —
    // {type:'chunk'} mientras narra en vivo, {type:'reset'} si hubo que descartar un borrador
    // (cuelgue/anacronismo del intento 1, ver narrador.ts), {type:'done'} con el mismo payload
    // que antes devolvía este endpoint de un tirón, o {type:'error'} si algo revienta a mitad.
    // Todas las validaciones (400/404 de arriba) ya pasaron antes de escribir cabeceras — una vez
    // empieza el stream no se puede cambiar de código de estado. hijack() le dice a Fastify que
    // el ciclo de vida de esta respuesta lo gestiona este handler a mano (reply.raw directamente),
    // para que no intente enviar su propia respuesta al terminar el handler.
    reply.hijack();
    // `@fastify/cors` engancha su cabecera en el hook `onRequest` vía `reply.header(...)`, que
    // Fastify solo vuelca a la respuesta real dentro de su propio `reply.send()` — al saltárnoslo
    // con `reply.raw.writeHead()` (necesario para el streaming NDJSON a mano) esa cabecera nunca
    // llega a escribirse. Bug real (2026-07-24, "sigue sin mostrar imágenes" + errores de CORS en
    // consola tras varias recargas): el navegador bloqueaba la respuesta entera de /turn/narrate
    // por falta de 'Access-Control-Allow-Origin', forzando una reconexión/recarga que perdía tanto
    // la narración en vivo como cualquier dato solo-de-cliente (como el banner de entidad citada).
    // Replica a mano lo que options.origin:true haría: refleja el Origin de la petición.
    reply.raw.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': request.headers.origin ?? '*',
      Vary: 'Origin',
    });

    // Bug real (jugando en vivo con Playwright, 2026-08-27, confirmado con un test de integración
    // reproducible: turn.integration.test.ts § 'Turno "fantasma"'): `reply.raw.write()` escribe
    // directamente en el socket TCP sin ningún try/catch — si el cliente ya cortó la conexión
    // (navegador cerrado, recarga, wifi caído) mientras el turno seguía narrándose, ese `write()`
    // lanza (EPIPE/ECONNRESET). `onNarrationChunk`/`onNarrationReset`/`onExchangeResolved` llaman a
    // `writeLine` DESDE DENTRO de `narrateAndPersistTurn` (services/turnResolution.ts), antes de su
    // propia transacción de persistencia — esa excepción abortaba la función entera sin que
    // ningún catch la loguera, dejando el turno "fantasma": la acción del jugador quedaba
    // registrada en el log, pero la narración de resultado nunca llegaba a persistirse, y el
    // jugador tenía que reintentar con OTRA acción distinta para que el juego volviera a avanzar.
    // El cliente ya no está para recibir esta línea de todos modos — ignorar el error de escritura
    // aquí deja que el resto de `narrateAndPersistTurn` siga corriendo hasta su transacción real.
    const writeLine = (payload: object) => {
      try {
        reply.raw.write(`${JSON.stringify(payload)}\n`);
      } catch {
        // Silenciado a propósito — ver comentario de arriba.
      }
    };

    const currentLocationForSummary = save.currentLocationId
      ? await prisma.location.findUnique({ where: { id: save.currentLocationId } })
      : null;
    const characterSummaryWithEstado = characterSummaryFor(save, {
      timeLabel,
      locationName: currentLocationForSummary?.name ?? null,
      region: currentLocationForSummary?.region ?? null,
      level: save.level,
      attributes,
      condicionFisica: save.condicionFisica,
      entorno: entornoTemporalFor(save.worldState?.fictionalMinutes ?? 0, currentLocationForSummary?.region ?? null, save.raza),
    });

    try {
      const {
        narration,
        progression,
        condicionFisica,
        activeEffects,
        energia,
        energiaMax,
        // Renombrado al desestructurar (evita chocar con el `timeLabel` de entrada, calculado
        // justo arriba a partir de `save.worldState` ANTES de este turno) — el nuevo `writeLine`
        // de más abajo manda este otro, el que ya incluye el avance de reloj de ESTE turno.
        timeLabel: newTimeLabel,
        entorno,
        combateIniciado,
        finDePartida,
        pendingDeathResolution,
        justDied,
        newInventoryItems,
        removedInventoryItemIds,
        updatedInventoryItems,
        logEntryId,
        quests,
        newQuestInfo,
        newQuestOfferInfo,
        dynamicModeOffer,
        travelResumed,
        questCompletedInfo,
        factionRepChange,
        newKingdomFounded,
        companionCreated,
        esperandoDefensaJugador,
        npcAbilityUsed,
        combatExchangeDisplay,
        playerAbilityUsed,
        nextInitiativeRoll,
        territories,
        buildings,
        subjects,
        kingdomStats,
        deathCount,
        factionsStatus,
        professionProgress,
        combatEncounterLootSummary,
      } = await narrateAndPersistTurn({
        saveId,
        worldId: save.worldId,
        action,
        characterSummary: characterSummaryWithEstado,
        characterName: save.characterName,
        clase: save.clase,
        timeLabel,
        sessionFacts,
        currentXp: save.xp,
        currentLevel: save.level,
        classification,
        roll,
        attributes,
        secondaryAttributes,
        defensa,
        equippedWeapons,
        equippedItems,
        unlockedRecipeKeys: save.unlockedRecipeKeys,
        raza: save.raza,
        currentLocationId: save.currentLocationId,
        travel,
        minutosDeEsteTurno,
        fictionalMinutesActuales: save.worldState?.fictionalMinutes ?? 480,
        produccion: duration?.produccion,
        condicionFisica: save.condicionFisica,
        energia: save.energia,
        activeEffects: parseActiveEffects(save.activeEffects),
        dificultad: save.dificultad,
        deathCount: save.deathCount,
        lastRestLocationId: save.lastRestLocationId,
        enCombate,
        savedActionId,
        isItemUse,
        // Auditoría de rendimiento 2026-07-28 ("rascar segundos") — reenviado tal cual desde
        // /turn/classify para esta misma acción; si falta (worldTick.ts, o un cliente viejo),
        // narrateAndPersistTurn lo calcula fresco él solo.
        npcsInScene,
        // Rediseño del turno de combate (2026-07-28) — dice si ESTE turno es la defensa a ciegas
        // del jugador contra un ataque de NPC ya decidido el intercambio anterior.
        pendingNpcAttack: save.pendingNpcAttack as unknown as PendingNpcAttack | null,
        pendingCombatNpcSlugs: (save.pendingCombatNpcSlugs as string[] | null) ?? [],
        lootItemNames,
        healItemUses,
        onNarrationChunk: (delta) => writeLine({ type: 'chunk', text: delta }),
        onNarrationReset: () => writeLine({ type: 'reset' }),
        // Animación de dados en paralelo (2026-08-15) — ver el mismo comentario en
        // NarrateAndPersistParams.onExchangeResolved: un evento NDJSON más, mismo patrón que
        // 'chunk'/'reset', disparado ANTES de que empiece a llegar texto de narración.
        onExchangeResolved: (exchange, npcName) => writeLine({ type: 'exchange', exchange, npcName }),
      });

      writeLine({
        type: 'done',
        narration,
        progression,
        condicionFisica,
        activeEffects,
        energia,
        energiaMax,
        timeLabel: newTimeLabel,
        entorno,
        combateIniciado,
        finDePartida,
        pendingDeathResolution,
        justDied,
        newInventoryItems,
        removedInventoryItemIds,
        updatedInventoryItems,
        logEntryId,
        quests,
        newQuestInfo,
        newQuestOfferInfo,
        dynamicModeOffer,
        travelResumed,
        questCompletedInfo,
        factionRepChange,
        newKingdomFounded,
        companionCreated,
        esperandoDefensaJugador,
        npcAbilityUsed,
        combatExchangeDisplay,
        playerAbilityUsed,
        nextInitiativeRoll,
        territories,
        buildings,
        subjects,
        kingdomStats,
        deathCount,
        factionsStatus,
        professionProgress,
        combatEncounterLootSummary,
      });
    } catch (err) {
      // Bug real (auditoría 2026-07-28): este catch mandaba `err.message` crudo al cliente,
      // saltándose la política que server.ts ya aplica a cualquier 500 no controlado (nunca
      // filtrar detalles internos — fallos de Prisma, de un proveedor de IA, etc.). El error real
      // se sigue viendo en los logs del servidor; el cliente recibe siempre el mismo mensaje
      // genérico.
      request.log.error(err);
      writeLine({ type: 'error', message: 'Error narrando el turno' });
    } finally {
      releaseTurnInFlight(saveId);
      reply.raw.end();
    }
  });
}
