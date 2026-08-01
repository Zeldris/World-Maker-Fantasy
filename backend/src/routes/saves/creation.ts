import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { energiaMaxFor } from '../../services/energy.js';
import { startingAbilitiesFor } from '../../services/startingAbilities.js';
import { GENERIC_COMBAT_ABILITIES } from '../../services/genericCombatAbilities.js';
import { classAbilityUnlocksFor } from '../../services/classAbilities.js';
import { startingInventoryFor } from '../../services/startingInventory.js';
import { razaFor } from '../../services/berigLore.js';
import { syncDynamicCombatAbilities, resolveEquippedWeaponSlots } from '../../services/dynamicAbilities.js';
import { startingSecondaryAttributesFor } from '../../services/startingSecondaryAttributes.js';
import { EMPTY_SECONDARY_ATTRIBUTES } from '../../services/secondaryAttributes.js';
import { initialLocationSlugFor } from '../../services/travel.js';
import { formatFictionalDate } from '../../services/worldClock.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';
import type { AttributeBlock } from '../../services/dice.js';
import { Prisma, type Dificultad } from '@prisma/client';
import { buildStartingQuestsData } from './shared.js';

interface CreateSaveBody {
  worldSlug: string;
  pregeneratedCharacterId?: string;
  characterName: string;
  characterArchetype: string;
  characterOrigin: string;
  characterMotivation: string;
  attributes: AttributeBlock;
  portraitInitial: string;
  introCharacterText: string;
  introWorldText: string;
  /// docs/14-combate-y-muerte.md § 4.2 — elegida en el mismo paso que el personaje. Default
  /// MEDIO si no se manda (partidas antiguas o clientes que todavía no la piden).
  dificultad?: Dificultad;
}

/// Ciclo de vida "arranca en Día 1" (deuda técnica 2026-07-30, split de saves.ts): crear una
/// partida nueva y reiniciar una existente comparten casi toda la lógica (kit inicial, misiones
/// de serie, Enciclopedia progresiva) — las dos viven juntas aquí en vez de separadas para que
/// ese paralelismo sea visible en un solo archivo.
export async function creationRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateSaveBody }>('/saves', async (request, reply) => {
    const {
      worldSlug,
      pregeneratedCharacterId,
      characterName,
      characterArchetype,
      characterOrigin,
      characterMotivation,
      attributes,
      portraitInitial,
      introCharacterText,
      introWorldText,
      dificultad,
    } = request.body;

    if (!worldSlug || !characterName || !attributes) {
      return reply.status(400).send({ error: 'Faltan campos: worldSlug, characterName, attributes' });
    }

    const world = await prisma.world.findUnique({ where: { slug: worldSlug } });
    if (!world) {
      return reply.status(404).send({ error: `No existe el mundo "${worldSlug}"` });
    }

    const userId = await getDefaultUserId();
    const fictionalDateLabel = formatFictionalDate(480);

    const initialLocationSlug = initialLocationSlugFor(characterName);
    const initialLocation = initialLocationSlug
      ? await prisma.location.findUnique({ where: { worldId_slug: { worldId: world.id, slug: initialLocationSlug } } })
      : null;
    const startingQuestsData = await buildStartingQuestsData(world.id, characterName);
    const secondaryAttributes = startingSecondaryAttributesFor(characterName) ?? EMPTY_SECONDARY_ATTRIBUTES;

    // Transacción única (auditoría 2026-07-28, fix #9): crear la partida y registrar sus
    // descubrimientos/primera visita de la Enciclopedia era antes tres awaits sueltos — un crash
    // justo entre medias dejaba una partida jugable pero con la Enciclopedia incompleta, sin forma
    // de recuperarla salvo reiniciar. Todo o nada.
    //
    // `timeout`/`maxWait` explícitos (bug real encontrado jugando en vivo, 2026-07-28): el pool de
    // Supabase (`DATABASE_URL`, eu-west-3, pgbouncer=true) + la latencia real desde la Steam Deck
    // (ver [[tarkor_rendimiento_prisma_relationjoins]]) hacen que una transacción interactiva con
    // varios awaits secuenciales supere de sobra el timeout por defecto de Prisma (5s) — el motor
    // cierra la transacción a mitad de camino y la siguiente query revienta con
    // `PrismaClientKnownRequestError P2028: Transaction not found`. Aquí solo son 2-3 queries, pero
    // se deja el mismo margen que en `restart` (más abajo, con muchas más) para no repetir el
    // diagnóstico si esta ruta crece.
    const save = await prisma.$transaction(
      async (tx) => {
        const save = await tx.save.create({
          data: {
            userId,
            worldId: world.id,
            pregeneratedCharacterId,
            characterName,
            characterArchetype,
            characterOrigin,
            characterMotivation,
            attributes,
            secondaryAttributes,
            // Sistema de fatiga (2026-07-29) — empieza con la energía llena, igual que
            // condicionFisica arranca en ILESO (aquí sí hace falta fijarlo a mano: el default del
            // schema es un 100 fijo, y el tope real depende de la Constitución de este personaje).
            energia: energiaMaxFor(attributes.constitucion),
            portraitInitial,
            currentLocationId: initialLocation?.id,
            dificultad: dificultad ?? 'MEDIO',
            raza: razaFor(characterName),
            worldState: { create: { fictionalDateLabel } },
            logEntries: {
              create: [
                { channel: 'CHARACTER', text: introCharacterText, timeLabel: fictionalDateLabel, fictionalMinutes: 480 },
                { channel: 'WORLD', text: introWorldText, timeLabel: fictionalDateLabel, fictionalMinutes: 480 },
              ],
            },
            savedActions: {
              // Bug real (2026-07-29, encontrado probando en vivo tras el rediseño "tope de 10"):
              // classAbilityUnlocksFor(characterName, lvl) solo se llamaba desde el bucle de
              // SUBIDA de nivel en turnResolution.ts (`for lvl = currentLevel+1 .. newLevel`) —
              // como las 4 habilidades de clase están todas en `level: 1` y todo personaje EMPIEZA
              // ya en nivel 1, ese bucle nunca las incluye (arranca en currentLevel+1 = 2): un
              // personaje recién creado nunca llegaba a tenerlas, nunca. Se conceden aquí, en la
              // creación, igual que las raciales/de arma (syncDynamicCombatAbilities más abajo).
              // isGeneric (2026-07-31): solo las 2 genéricas de aquí (Defenderse/Esquivar) lo
              // llevan — separadas en su propio `.map` para no marcar como genéricas ni las
              // habilidades "de serie" del personaje ni las de clase.
              create: [
                ...startingAbilitiesFor(characterName).map((a) => ({ ...a, isStarting: true })),
                ...GENERIC_COMBAT_ABILITIES.map((a) => ({ ...a, isStarting: true, isGeneric: true })),
                ...classAbilityUnlocksFor(characterName, 1).map((a) => ({ ...a, isStarting: true })),
              ],
            },
            inventoryItems: {
              create: startingInventoryFor(characterName),
            },
            quests: {
              create: startingQuestsData,
            },
          },
          include: { inventoryItems: true },
        });

        // Habilidades raciales + de arma (2026-07-29, sistema de habilidades por arma) — se
        // resuelven ya aquí, en la creación, para que el kit inicial (hacha+cuchillo de Gorhorn)
        // genere sus habilidades desde el primer turno, no solo tras el primer equipar/desequipar.
        const equippedWeaponSlots = await resolveEquippedWeaponSlots(tx, world.id, save.inventoryItems);
        await syncDynamicCombatAbilities(tx, save.id, save.raza, save.level, equippedWeaponSlots);

        // Enciclopedia progresiva (2026-07-23) — el equipo inicial ya se "conoce" desde el primer
        // instante, sin esperar a que un turno lo mencione (si no, el propio equipo del jugador se
        // vería como "???" hasta su primera acción). También el objetivo de las misiones "de serie"
        // (2026-07-25, petición explícita: citar un elemento del catálogo en el objetivo lo desbloquea).
        await recordEntityDiscoveries(
          {
            saveId: save.id,
            worldId: world.id,
            mentionedText: startingQuestsData
              .map((q) => q.objetivo)
              .filter((o): o is string => !!o)
              .join('\n'),
          },
          tx,
        );
        // Misma lógica para el propio lugar de partida (bug real encontrado auditando la partida de
        // Gorhorn: no había ningún `LocationVisit` para la Hondonada del Eco pese a llevar toda la
        // partida ahí) — inserción directa, no pasa por turnResolution.ts, así que no dispara el
        // hito/XP de "descubrimiento" que sí aplica a lugares nuevos alcanzados jugando.
        if (initialLocation) {
          await tx.locationVisit.upsert({
            where: { saveId_locationId: { saveId: save.id, locationId: initialLocation.id } },
            create: { saveId: save.id, locationId: initialLocation.id },
            update: {},
          });
        }

        return save;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    return { id: save.id };
  });

  app.post<{ Params: { id: string }; Body: { introCharacterText?: string; introWorldText?: string } }>('/saves/:id/restart', async (request, reply) => {
    // Resetea ESTA partida a Día 1 (borra su log y sus hechos) sin borrar la fila de Save —
    // sigue en la lista, con el mismo id, distinto de borrarla del todo (DELETE /saves/:id).
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { world: true },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    const fictionalDateLabel = formatFictionalDate(480);
    // Intro propia por personaje pregenerado (2026-07-28) — CharacterSaves.tsx ya conoce el
    // personaje de esta partida (`data/mock.ts`, la misma fuente que usa la creación de partida
    // nueva) y manda su intro propia si la tiene; si no llega nada (personaje sin intro propia,
    // o partida custom), cae a la misma plantilla genérica de siempre.
    const introCharacterText =
      request.body?.introCharacterText ??
      `${save.characterName} llega a las tierras de ${save.world.name}. ${save.characterMotivation} Todo lo que ocurra a partir de ahora empieza aquí.`;
    const introWorldText =
      request.body?.introWorldText ?? `El mundo de ${save.world.name} sigue su curso, ajeno por ahora a la llegada de un nuevo actor en la historia.`;

    const initialLocationSlug = initialLocationSlugFor(save.characterName);
    const initialLocation = initialLocationSlug
      ? await prisma.location.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: initialLocationSlug } } })
      : null;
    const startingQuestsData = await buildStartingQuestsData(save.worldId, save.characterName);

    // Callback en vez de array de operaciones (auditoría 2026-07-28, fix #9): el registro de
    // descubrimientos/primera visita de más abajo antes vivía en dos awaits sueltos DESPUÉS de este
    // array — un crash entre medias dejaba la partida reiniciada pero con la Enciclopedia sin sus
    // datos "de serie". Ahora es una única transacción, todo o nada, igual que en POST /saves.
    //
    // `timeout`/`maxWait` explícitos (bug real jugando en vivo, 2026-07-28): esta transacción
    // encadena ~17 queries secuenciales — contra el pool remoto de Supabase (pgbouncer=true,
    // eu-west-3) con la latencia real de la Steam Deck, eso supera de sobra el timeout por defecto
    // de Prisma (5s) y el motor cierra la transacción a mitad de camino: la query que llega tarde
    // revienta con `PrismaClientKnownRequestError P2028: Transaction not found` — reproducido en
    // aislado fuera de Fastify, mismo error exacto que "Reiniciar" daba en el frontend (el 500
    // genérico solo decía "Error interno del servidor", sin este dato).
    await prisma.$transaction(
      async (tx) => {
        await tx.logEntry.deleteMany({ where: { saveId: save.id } });
        await tx.inventoryItem.deleteMany({ where: { saveId: save.id } });
        await tx.companion.deleteMany({ where: { saveId: save.id } });
        await tx.subject.deleteMany({ where: { saveId: save.id } });
        await tx.building.deleteMany({ where: { saveId: save.id } });
        await tx.territory.deleteMany({ where: { saveId: save.id } });
        await tx.characterTransit.deleteMany({ where: { saveId: save.id } });
        await tx.savedAction.deleteMany({ where: { saveId: save.id } });
        await tx.locationVisit.deleteMany({ where: { saveId: save.id } });
        await tx.quest.deleteMany({ where: { saveId: save.id } });
        await tx.sessionSummary.deleteMany({ where: { saveId: save.id } });
        // NpcState (2026-07-19): sin esto, la condición física/saqueo de un NPC de una partida
        // anterior sobrevivía al "reiniciar" — un NPC ya derrotado seguía derrotado en el Día 1
        // nuevo, en vez de volver a ILESO como todo lo demás.
        await tx.npcState.deleteMany({ where: { saveId: save.id } });
        // Bug real (2026-07-23, encontrado al reiniciar la partida real de Gorhorn): ProfessionProgress
        // y KingdomStats no se borraban — un nivel de oficio o una economía de reino ya fundada
        // sobrevivían a "reiniciar", igual de incoherente que el NpcState de arriba antes de aquel fix.
        await tx.professionProgress.deleteMany({ where: { saveId: save.id } });
        await tx.kingdomStats.deleteMany({ where: { saveId: save.id } });
        // Enciclopedia progresiva (2026-07-23): reiniciar vuelve a Día 1 también en lo que ya se
        // "conoce" — sin esto, la Enciclopedia de una partida recién reiniciada seguiría mostrando
        // NPCs/fauna/objetos de la partida anterior como ya descubiertos.
        await tx.discoveredEntity.deleteMany({ where: { saveId: save.id } });
        // `facts` vivía aquí como columna de WorldState — migró a la tabla SessionFact (2026-07-30,
        // ver worldFacts.ts). Bug real (2026-07-31, encontrado jugando: "Reiniciar" daba 500):
        // esta ruta se quedó sin actualizar en esa migración, seguía escribiendo `facts: []` en un
        // campo que ya no existe. Reiniciar ahora borra sus SessionFact reales — mismo espíritu
        // que el resto del reset (npcState/quest/etc.), Día 1 sin ningún hecho previo.
        await tx.sessionFact.deleteMany({ where: { saveId: save.id } });
        await tx.worldState.update({
          where: { saveId: save.id },
          data: { fictionalDateLabel, fictionalMinutes: 480, agenda: [], factionsStatus: {} },
        });
        await tx.logEntry.create({
          data: { saveId: save.id, channel: 'CHARACTER', text: introCharacterText, timeLabel: fictionalDateLabel },
        });
        await tx.logEntry.create({
          data: { saveId: save.id, channel: 'WORLD', text: introWorldText, timeLabel: fictionalDateLabel },
        });
        await tx.savedAction.createMany({
          // Mismo bug que en POST /saves (ver comentario de arriba): las habilidades de clase
          // (level:1) tampoco se concedían al reiniciar. isGeneric (2026-07-31): mismo criterio
          // que la creación — solo las 2 genéricas de aquí lo llevan.
          data: [
            ...startingAbilitiesFor(save.characterName).map((a) => ({ ...a, saveId: save.id, isStarting: true })),
            ...GENERIC_COMBAT_ABILITIES.map((a) => ({ ...a, saveId: save.id, isStarting: true, isGeneric: true })),
            ...classAbilityUnlocksFor(save.characterName, 1).map((a) => ({ ...a, saveId: save.id, isStarting: true })),
          ],
        });
        const restartedInventory = await tx.inventoryItem.createManyAndReturn({
          data: startingInventoryFor(save.characterName).map((i) => ({ ...i, saveId: save.id })),
        });
        // Bug real (2026-07-29, encontrado probando en vivo): reiniciar nunca llamaba a
        // syncDynamicCombatAbilities — las raciales/de arma (isDynamic) se borraban arriba junto
        // con el resto de savedActions y no se volvían a crear hasta el próximo equipar/desequipar
        // manual, dejando al personaje sin ellas justo después de "reiniciar".
        const restartedEquippedWeaponSlots = await resolveEquippedWeaponSlots(tx, save.worldId, restartedInventory);
        await syncDynamicCombatAbilities(tx, save.id, save.raza, 1, restartedEquippedWeaponSlots);
        await tx.quest.createMany({
          data: startingQuestsData.map((q) => ({ ...q, saveId: save.id })),
        });
        await tx.save.update({
          where: { id: save.id },
          data: {
            lastPlayedAt: new Date(),
            level: 1,
            xp: 0,
            pendingAttributePoints: 0,
            kingdomName: null,
            profession: null,
            currentLocationId: initialLocation?.id ?? null,
            // docs/14-combate-y-muerte.md § 4.4: reiniciar borra el fin de partida y el contador
            // de muertes — la dificultad elegida al crear la partida NO se resetea (es una
            // preferencia de la partida, no parte del progreso que "reiniciar" debe borrar).
            condicionFisica: 'ILESO',
            salud: 100,
            // Sistema de fatiga (2026-07-29) — mismo criterio que condicionFisica/salud: un
            // reinicio también restaura la energía al tope (Constitución no se resetea, así que
            // se recalcula sobre la misma, no un 100 fijo).
            energia: energiaMaxFor((save.attributes as AttributeBlock).constitucion),
            deathCount: 0,
            endedAt: null,
            lastRestLocationId: null,
            pausedAt: null,
            // Bug real jugando en vivo (2026-08-01, "al reiniciar la partida me empieza en
            // combate"): estos dos campos son la única fuente de la que GET /saves/:id reconstruye
            // el aviso de "Combatir" tras una resincronización (ver comentario de
            // `pendingCombatSlugs` en saves/detail.ts) — sin resetearlos aquí, un combate sin
            // cerrar de la partida ANTERIOR (p. ej. un NPC ya derrotado y saqueado, cuyo slug
            // seguía en `pendingCombatNpcSlugs` porque nunca llegó a vaciarse) sobrevivía al
            // reinicio entero: Día 1, ILESO, inventario limpio... y aun así con el popup de combate
            // listo para abrirse contra un enemigo que ya no existe en esta partida nueva.
            pendingCombatNpcSlugs: [],
            pendingNpcAttack: Prisma.JsonNull,
          },
        });

        // Mismo motivo que en POST /saves — el equipo inicial ya se "conoce" desde ya, y el objetivo
        // de las misiones "de serie" también puede desbloquear algo de la Enciclopedia.
        await recordEntityDiscoveries(
          {
            saveId: save.id,
            worldId: save.worldId,
            mentionedText: startingQuestsData
              .map((q) => q.objetivo)
              .filter((o): o is string => !!o)
              .join('\n'),
          },
          tx,
        );
        if (initialLocation) {
          await tx.locationVisit.upsert({
            where: { saveId_locationId: { saveId: save.id, locationId: initialLocation.id } },
            create: { saveId: save.id, locationId: initialLocation.id },
            update: {},
          });
        }
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    return { id: save.id };
  });
}
