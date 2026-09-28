import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { energiaMaxFor } from '../../services/energy.js';
import { startingAbilitiesFor } from '../../services/startingAbilities.js';
import { GENERIC_COMBAT_ABILITIES } from '../../services/genericCombatAbilities.js';
import { classAbilityUnlocksFor } from '../../services/classAbilities.js';
import { startingInventoryFor } from '../../services/startingInventory.js';
import { startingProfessionsFor } from '../../services/startingProfessions.js';
import { professionAbilityUnlocksFor } from '../../services/professionAbilities.js';
import { harvestAbilityUnlocksFor } from '../../services/harvestAbilities.js';
import { razaFor } from '../../services/berigLore.js';
import { syncDynamicCombatAbilities, resolveEquippedWeaponSlots } from '../../services/dynamicAbilities.js';
import { startingSecondaryAttributesFor } from '../../services/startingSecondaryAttributes.js';
import { EMPTY_SECONDARY_ATTRIBUTES } from '../../services/secondaryAttributes.js';
import { initialLocationSlugFor } from '../../services/travel.js';
import { formatFictionalDate } from '../../services/worldClock.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';
import type { AttributeBlock } from '../../services/dice.js';
import { type Dificultad } from '@prisma/client';
import { buildStartingQuestsData, VALID_ATTRIBUTES, withCatalogStatBonuses, restartSaveTransactionBody } from './shared.js';

/// Auditoría 2026-08-11 ("pruebas por API"): el guard de la ruta solo cubría 3 de los ~10 campos
/// `string` no opcionales de `CreateSaveBody` — faltar cualquier otro (p. ej. `characterOrigin`)
/// no daba un 400 claro, reventaba con un 500 genérico más abajo (algún campo `String` no-nulo de
/// Prisma recibiendo `undefined`). Sin corrupción de datos (todo vive en una única transacción que
/// revierte limpia), pero el mensaje de error era inútil para cualquier cliente que no replique
/// exactamente el formulario de creación actual.
function validationErrorFor(body: CreateSaveBody): string | null {
  const requiredStringFields: (keyof CreateSaveBody)[] = [
    'worldSlug',
    'characterName',
    'characterArchetype',
    'characterOrigin',
    'characterMotivation',
    'portraitInitial',
    'introCharacterText',
    'introWorldText',
  ];
  const missing = requiredStringFields.filter((field) => !body[field]);
  if (missing.length > 0) return `Faltan campos: ${missing.join(', ')}`;

  if (!body.attributes || typeof body.attributes !== 'object') return 'Falta el campo: attributes';
  const attributeKeys = Object.keys(body.attributes);
  const missingAttributes = VALID_ATTRIBUTES.filter((a) => !attributeKeys.includes(a));
  if (missingAttributes.length > 0) return `Faltan atributos: ${missingAttributes.join(', ')}`;
  const invalidValue = VALID_ATTRIBUTES.find((a) => typeof body.attributes[a] !== 'number');
  if (invalidValue) return `El atributo "${invalidValue}" debe ser un número`;

  return null;
}

/// Bug real jugando en vivo (2026-08-13, "las estadísticas del inventario inicial no salen"):
/// `GORHORN_STARTING_INVENTORY` (startingInventory.ts) enlaza cada objeto a su ItemCatalog vía
/// `catalogSlug`, pero ninguna entrada rellena `statBonuses` a mano — a diferencia del saqueo/
/// crafteo real (turnResolution.ts), que SÍ copian `statBonuses` del catálogo al crear la
/// InventoryItem, esta ruta nunca lo hacía, así que el hacha/cuchillo/armadura "de serie" de
/// Gorhorn se creaban con `statBonuses: null` para siempre. Se resuelve aquí, una sola vez, contra
/// ItemCatalog — mismo criterio de "el catálogo es la fuente de verdad" que ya usa
/// `grantQuestRewardItems`.
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
  /// docs/mecanicas/14-combate-y-muerte.md § 4.2 — elegida en el mismo paso que el personaje. Default
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

    const validationError = validationErrorFor(request.body);
    if (validationError) {
      return reply.status(400).send({ error: validationError });
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
    const razaSlug = razaFor(characterName);
    const startingProfessions = startingProfessionsFor(characterName, razaSlug, initialLocation?.region ?? null);
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
            // Punto del jugador en el mapa de Zona (2026-09-04) — bug real jugando en vivo
            // (2026-09-06, "la zona no está presentando a Gorhorn"): sin esto, una partida nueva
            // nunca disparaba el único camino que fija estos campos (`turnResolution.ts`, bloque de
            // viaje) hasta el primer viaje real — un personaje que arranca y actúa sin viajar aún
            // se quedaba sin marcador para siempre.
            //
            // Reubicado del centro exacto del lienzo (400,300) a la esquina noroeste (2026-09-17,
            // bug real jugando en vivo — Álvaro: "reincio una partida... y ya estoy chocando con un
            // Kirelon nada más reiniciar") — con la persecución de AGRESIVO/ENEMIGO nueva
            // (`RADIO_PERSECUCION_CELDAS`, movementTemplates.ts), el centro (celda 8,6) queda a
            // solo 1 celda del Orco Enfurecido (celda 9,5) — toda partida nueva empezaba ya
            // perseguida/colisionando desde el turno 1. `initialLocationSlugFor` hoy solo apunta a
            // "hondonada-del-eco" (único personaje inicial real, "Gorhorn"), así que este número es
            // específico de esa zona — calibrado contra el catálogo real: la esquina noroeste
            // (celda 1,1) queda a 8+ celdas de cualquier agresivo conocido (Orco/Kirelon), muy por
            // encima del radio de persecución.
            zonaPosX: 75,
            zonaPosY: 75,
            zonaPosEntradaX: 75,
            zonaPosEntradaY: 75,
            dificultad: dificultad ?? 'MEDIO',
            raza: razaSlug,
            // Hambre/Sed (Grupo 3 § Compañeros y supervivencia, 2026-08-25) — sembrado al reloj
            // inicial (480 = Día 1, mañana, mismo valor que el resto de esta creación) para que un
            // personaje recién creado no arranque ya hambriento.
            lastAteAtMinutes: 480,
            lastDrankAtMinutes: 480,
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
              // Mismo bug de "nivel 1 al crear" (comentario de arriba) también le toca a las
              // habilidades de oficio (2026-08-07, rediseño de profesiones): Gorhorn empieza con
              // varios oficios YA a nivel 1 (startingProfessionsFor) — sin conceder aquí sus
              // desbloqueos de nivel 1, nunca los recibiría (professionAbilityUnlocksFor/
              // harvestAbilityUnlocksFor solo se llaman desde el bucle de SUBIDA de nivel de
              // turnResolution.ts, que arranca en nivel+1).
              create: [
                ...startingAbilitiesFor(characterName).map((a) => ({ ...a, isStarting: true })),
                ...GENERIC_COMBAT_ABILITIES.map((a) => ({ ...a, isStarting: true, isGeneric: true })),
                ...classAbilityUnlocksFor(characterName, 1, null).map((a) => ({ ...a, isStarting: true })),
                ...startingProfessions.flatMap((oficio) => [
                  ...professionAbilityUnlocksFor(oficio, 1).map((a) => ({ ...a, isStarting: true })),
                  ...harvestAbilityUnlocksFor(oficio, 1).map((a) => ({ ...a, isStarting: true })),
                ]),
              ],
            },
            inventoryItems: {
              create: await withCatalogStatBonuses(tx, world.id, startingInventoryFor(characterName)),
            },
            quests: {
              create: startingQuestsData,
            },
            professionProgress: {
              create: startingProfessions.map((professionId) => ({ professionId })),
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

    // Intro propia por personaje pregenerado (2026-07-28) — CharacterSaves.tsx ya conoce el
    // personaje de esta partida (`data/mock.ts`, la misma fuente que usa la creación de partida
    // nueva) y manda su intro propia si la tiene; si no llega nada (personaje sin intro propia,
    // o partida custom), cae a la misma plantilla genérica de siempre.
    const introCharacterText =
      request.body?.introCharacterText ??
      `${save.characterName} llega a las tierras de ${save.world.name}. ${save.characterMotivation} Todo lo que ocurra a partir de ahora empieza aquí.`;
    const introWorldText =
      request.body?.introWorldText ?? `El mundo de ${save.world.name} sigue su curso, ajeno por ahora a la llegada de un nuevo actor en la historia.`;

    // Cuerpo real extraído a shared.ts (2026-08-31, muerte permanente) — reutilizado tal cual por
    // POST /saves/:id/death/resolve cuando toca reiniciar la partida entera. `timeout`/`maxWait`
    // explícitos (bug real jugando en vivo, 2026-07-28): esta transacción encadena ~17 queries
    // secuenciales — contra el pool remoto de Supabase (pgbouncer=true, eu-west-3) con la latencia
    // real de la Steam Deck, eso supera de sobra el timeout por defecto de Prisma (5s) y el motor
    // cierra la transacción a mitad de camino: la query que llega tarde revienta con
    // `PrismaClientKnownRequestError P2028: Transaction not found` — reproducido en aislado fuera
    // de Fastify, mismo error exacto que "Reiniciar" daba en el frontend (el 500 genérico solo
    // decía "Error interno del servidor", sin este dato).
    await prisma.$transaction(async (tx) => restartSaveTransactionBody(tx, save, introCharacterText, introWorldText), {
      maxWait: 10_000,
      timeout: 20_000,
    });

    return { id: save.id };
  });
}
