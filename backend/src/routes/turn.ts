import type { FastifyInstance } from 'fastify';
import { classifyAction, type ClassificationResult } from '../services/narrador.js';
import { rollCheck } from '../services/dice.js';
import type { AttributeBlock, RollResult } from '../services/dice.js';
import { computeDuration, detectsRestIntent, mentionsExplicitDuration } from '../services/timedActions.js';
import { narrateAndPersistTurn } from '../services/turnResolution.js';
import type { PendingNpcAttack } from '../services/combatExchange.js';
import { resolveTravel, bandaForMinutos, type TravelResolution } from '../services/travel.js';
import { effectiveAttributes, effectiveDefense, equippedWeaponNames, equippedItemsSummary } from '../services/equipment.js';
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
import { matchHarvestSource } from '../services/harvest.js';
import { detectsSearchIntent, selectDiscoveries, type DiscoveryItem } from '../services/discovery.js';
import { normalizeText } from '../services/travel.js';
import { detectsOwnedItemQuote } from '../services/itemReference.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { peekCachedClassify, setCachedClassify, consumeCachedClassify } from '../lib/classifyCache.js';
import { normalizeSecondaryAttributes } from '../services/secondaryAttributes.js';
import { characterSummaryFor } from '../services/characterSummary.js';
import { loadSessionFacts } from '../services/worldFacts.js';

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
}): Promise<ClassificationResolution> {
  const { saveId, action, enCombate, savedActionId, preview, worldId, currentLocationId, level, attributes, sessionFacts, characterSummary } = params;

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
    npcsInScene = await detectNpcsInScene({ action, worldId, sessionFacts, saveId, currentLocationId });

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
      const selectedAbility = savedActionId
        ? await prisma.savedAction.findUnique({ where: { id: savedActionId }, select: { effect: true, preferredAttribute: true } })
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
      const tabulatedTarget =
        npcsInScene.length > 0 &&
        ((enCombate && (detectsAttackIntent(action) || !!selectedAbility?.effect)) ||
          (!enCombate && detectsHostileSearchIntent(action) && !detectsVerbalAcceptanceIntent(action)))
          ? (explicitTarget ?? npcsInScene[0])
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

    if (save.characterTransit && save.characterTransit.busyUntil > new Date()) {
      return reply.status(409).send({
        error: 'El personaje sigue ocupado',
        activity: save.characterTransit.activity,
        busyUntil: save.characterTransit.busyUntil,
        duracionMinutos: (save.characterTransit.zoneContext as { duracionMinutos?: number } | null)?.duracionMinutos ?? null,
      });
    }

    // Estadísticas de objetos (2026-07-19): la tirada usa los atributos EFECTIVOS (base + lo
    // que sume el equipo puesto), nunca los atributos crudos guardados en el personaje.
    const attributes = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
    const sessionFacts = await loadSessionFacts(save.id);
    const currentLocationForSummary = save.currentLocationId
      ? await prisma.location.findUnique({ where: { id: save.currentLocationId } })
      : null;
    const characterSummary = characterSummaryFor(save, {
      timeLabel,
      locationName: currentLocationForSummary?.name ?? null,
      region: currentLocationForSummary?.region ?? null,
      level: save.level,
      attributes,
      condicionFisica: save.condicionFisica,
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
    });

    const { minutos, produccion } = travel
      ? { minutos: travel.minutos, produccion: undefined }
      : computeDuration(action, classification.banda, attributes, classification.duracionEstimadaMinutos);

    if (preview) {
      return {
        classification,
        roll,
        travel,
        duracionMinutos: minutos,
        produccion: produccion ? `${produccion.cantidad} de ${produccion.itemName}` : undefined,
      };
    }

    if (classification.banda === 'extendida' || classification.banda === 'larga') {
      // Compresión de tiempo (roadmap 2026-07-19): `minutos` es tiempo de FICCIÓN — mapearlo 1:1 a
      // espera real hacía matemáticamente imposible una sesión fluida (un viaje interno normal ya
      // son 83-248 min de ficción con el grafo actual). El reloj ficticio sigue avanzando el total
      // real de `minutos` sin comprimir (ver narrateAndPersistTurn) — solo se comprime la espera.
      const minutosReales = Math.min(Math.max(1, minutos / env.fictionMinutesPerRealMinute), env.transitMaxRealMinutes);
      const busyUntil = new Date(Date.now() + minutosReales * 60_000);
      const produccionLabel = produccion ? `${produccion.cantidad} de ${produccion.itemName}` : undefined;
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
      await prisma.$transaction([
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
          create: { saveId, activity: action, busyUntil, zoneContext: { action, classification, roll, travel, duracionMinutos: minutos } as object },
          update: { activity: action, busyUntil, zoneContext: { action, classification, roll, travel, duracionMinutos: minutos } as object },
        }),
        prisma.save.update({ where: { id: saveId }, data: { lastPlayedAt: new Date() } }),
      ]);

      // Petición explícita de la usuaria (2026-07-30): "cuando salgan esas esperas que ponga
      // ej: 7 mins de tiempo real 2 dias en Helek" — sin esto, la espera solo mostraba el
      // tiempo real comprimido, sin ninguna pista de cuánto dura DE VERDAD la acción dentro de
      // la ficción, dejando la pregunta "¿por qué tarda tanto?" sin respuesta visible en la UI.
      return { classification, roll, transit: { busyUntil, duracionMinutos: minutos }, travel };
    }

    // Instantánea/corta: el jugador verá el turno completo en esta misma sesión — deja ya la
    // acción del jugador en el log para que aparezca de inmediato, antes de esperar a narrar.
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: action, isPlayerAction: true, timeLabel },
    });

    // Revelado progresivo (docs/14-combate-y-muerte.md § 3.1): solo para búsquedas/recolección
    // GENÉRICAS de banda corta (sin especie concreta mencionada — eso ya lo resuelve harvest.ts
    // en narrate) y con la tirada ya superada (o sin tirada). El backend decide QUÉ se encuentra
    // aquí mismo, en classify, para que el frontend pueda arrancar ya el contador con revelado.
    let discoveries: DiscoveryItem[] = [];
    if (!travel && classification.banda === 'corta' && (!roll || roll.success) && !matchHarvestSource(action) && detectsSearchIntent(action)) {
      discoveries = await selectDiscoveries(save.worldId, save.currentLocationId);
    }

    const produccionLabel = produccion ? `${produccion.cantidad} de ${produccion.itemName}` : undefined;
    // Auditoría de rendimiento 2026-07-28 ("rascar segundos"): `npcsInScene` viaja tal cual hasta
    // el frontend para que /turn/narrate lo reciba de vuelta y no tenga que recalcularlo — ver
    // NarrateBody.npcsInScene más abajo y el mismo comentario en turnResolution.ts.
    return { classification, roll, duracionMinutos: minutos, produccion: produccionLabel, travel, discoveries, npcsInScene };
  });

  app.post<{ Body: NarrateBody }>('/turn/narrate', async (request, reply) => {
    const { saveId, action, classification, roll, travel, enCombate, savedActionId, npcsInScene, lootItemNames } = request.body;
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

    const sessionFacts = await loadSessionFacts(save.id);
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
    const attributes = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
    const secondaryAttributes = normalizeSecondaryAttributes(save.secondaryAttributes);
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

    const writeLine = (payload: object) => reply.raw.write(`${JSON.stringify(payload)}\n`);

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
    });

    try {
      const {
        narration,
        progression,
        condicionFisica,
        energia,
        energiaMax,
        combateIniciado,
        finDePartida,
        justDied,
        newInventoryItems,
        logEntryId,
        quests,
        newQuestInfo,
        esperandoDefensaJugador,
        npcAbilityUsed,
        nextInitiativeRoll,
      } = await narrateAndPersistTurn({
        saveId,
        worldId: save.worldId,
        action,
        characterSummary: characterSummaryWithEstado,
        characterName: save.characterName,
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
        raza: save.raza,
        currentLocationId: save.currentLocationId,
        travel,
        minutosDeEsteTurno,
        fictionalMinutesActuales: save.worldState?.fictionalMinutes ?? 480,
        produccion: duration?.produccion,
        condicionFisica: save.condicionFisica,
        energia: save.energia,
        dificultad: save.dificultad,
        deathCount: save.deathCount,
        lastRestLocationId: save.lastRestLocationId,
        enCombate,
        savedActionId,
        // Auditoría de rendimiento 2026-07-28 ("rascar segundos") — reenviado tal cual desde
        // /turn/classify para esta misma acción; si falta (worldTick.ts, o un cliente viejo),
        // narrateAndPersistTurn lo calcula fresco él solo.
        npcsInScene,
        // Rediseño del turno de combate (2026-07-28) — dice si ESTE turno es la defensa a ciegas
        // del jugador contra un ataque de NPC ya decidido el intercambio anterior.
        pendingNpcAttack: save.pendingNpcAttack as unknown as PendingNpcAttack | null,
        lootItemNames,
        onNarrationChunk: (delta) => writeLine({ type: 'chunk', text: delta }),
        onNarrationReset: () => writeLine({ type: 'reset' }),
      });

      writeLine({
        type: 'done',
        narration,
        progression,
        condicionFisica,
        energia,
        energiaMax,
        combateIniciado,
        finDePartida,
        justDied,
        newInventoryItems,
        logEntryId,
        quests,
        newQuestInfo,
        esperandoDefensaJugador,
        npcAbilityUsed,
        nextInitiativeRoll,
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
      reply.raw.end();
    }
  });
}
