import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { MAX_ATTRIBUTE, habilidadSlotsForLevel } from '../services/progression.js';
import { mergeFacts } from '../services/worldFacts.js';
import { startingAbilitiesFor } from '../services/startingAbilities.js';
import type { AttributeBlock, Attribute } from '../services/dice.js';

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
}

function toFrontendLogEntry(entry: {
  id: string;
  channel: string;
  text: string;
  roll: unknown;
  isPlayerAction: boolean;
  timeLabel: string;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    channel: entry.channel.toLowerCase(),
    text: entry.text,
    timeLabel: entry.timeLabel,
    roll: entry.roll ?? undefined,
    isPlayerAction: entry.isPlayerAction || undefined,
    createdAt: entry.createdAt.toISOString(),
  };
}

/// Rutas de persistencia real de partidas (decisión 2026-07-17: /turn y /entorno dejan de ser
/// stateless — el frontend crea una partida una vez y a partir de ahí solo manda `saveId`).
export async function savesRoutes(app: FastifyInstance) {
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
    } = request.body;

    if (!worldSlug || !characterName || !attributes) {
      return reply.status(400).send({ error: 'Faltan campos: worldSlug, characterName, attributes' });
    }

    const world = await prisma.world.findUnique({ where: { slug: worldSlug } });
    if (!world) {
      return reply.status(404).send({ error: `No existe el mundo "${worldSlug}"` });
    }

    const userId = await getDefaultUserId();
    const fictionalDateLabel = 'Día 1, mañana';

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        pregeneratedCharacterId,
        characterName,
        characterArchetype,
        characterOrigin,
        characterMotivation,
        attributes,
        portraitInitial,
        worldState: { create: { fictionalDateLabel } },
        logEntries: {
          create: [
            { channel: 'CHARACTER', text: introCharacterText, timeLabel: fictionalDateLabel },
            { channel: 'WORLD', text: introWorldText, timeLabel: fictionalDateLabel },
          ],
        },
        savedActions: {
          create: startingAbilitiesFor(characterName).map((a) => ({ ...a, isStarting: true })),
        },
      },
    });

    return { id: save.id };
  });

  app.get<{ Params: { id: string } }>('/saves/:id', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: {
        world: true,
        worldState: true,
        logEntries: { orderBy: { createdAt: 'asc' } },
        inventoryItems: { orderBy: { createdAt: 'asc' } },
        companions: { orderBy: { createdAt: 'asc' } },
        territories: { orderBy: { acquiredAt: 'asc' } },
        buildings: { orderBy: { createdAt: 'asc' } },
        subjects: { orderBy: { createdAt: 'asc' } },
        characterTransit: true,
        savedActions: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    return {
      id: save.id,
      worldSlug: save.world.slug,
      worldName: save.world.name,
      characterName: save.characterName,
      characterArchetype: save.characterArchetype,
      characterOrigin: save.characterOrigin,
      characterMotivation: save.characterMotivation,
      attributes: save.attributes,
      portraitInitial: save.portraitInitial,
      fictionalDateLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      characterLog: save.logEntries.filter((e) => e.channel === 'CHARACTER').map(toFrontendLogEntry),
      worldLog: save.logEntries.filter((e) => e.channel === 'WORLD').map(toFrontendLogEntry),
      inventory: save.inventoryItems.map((i) => ({ id: i.id, name: i.name, description: i.description, origin: i.origin })),
      companions: save.companions.map((c) => ({ id: c.id, name: c.name, role: c.role, notes: c.notes })),
      level: save.level,
      xp: save.xp,
      pendingAttributePoints: save.pendingAttributePoints,
      kingdomName: save.kingdomName,
      territories: save.territories.map((t) => ({
        id: t.id,
        name: t.name,
        region: t.region,
        description: t.description,
        control: t.control,
        population: t.population,
      })),
      buildings: save.buildings.map((b) => ({
        id: b.id,
        territoryId: b.territoryId,
        name: b.name,
        kind: b.kind,
        status: b.status,
        description: b.description,
      })),
      subjects: save.subjects.map((s) => ({
        id: s.id,
        territoryId: s.territoryId,
        name: s.name,
        role: s.role,
        notes: s.notes,
      })),
      transit: save.characterTransit
        ? { activity: save.characterTransit.activity, busyUntil: save.characterTransit.busyUntil.toISOString() }
        : null,
      savedActions: save.savedActions.map((a) => ({
        id: a.id,
        name: a.name,
        promptText: a.promptText,
        icon: a.icon,
        description: a.description,
        isStarting: a.isStarting,
        category: a.category,
      })),
      habilidadSlots: habilidadSlotsForLevel(save.level),
      profession: save.profession,
    };
  });

  app.post<{ Params: { id: string } }>('/saves/:id/restart', async (request, reply) => {
    // Resetea ESTA partida a Día 1 (borra su log y sus hechos) sin borrar la fila de Save —
    // sigue en la lista, con el mismo id, distinto de borrarla del todo (DELETE /saves/:id).
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { world: true },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    const fictionalDateLabel = 'Día 1, mañana';
    const introCharacterText = `${save.characterName} llega a las tierras de ${save.world.name}. ${save.characterMotivation} Todo lo que ocurra a partir de ahora empieza aquí.`;
    const introWorldText = `El mundo de ${save.world.name} sigue su curso, ajeno por ahora a la llegada de un nuevo actor en la historia.`;

    await prisma.$transaction([
      prisma.logEntry.deleteMany({ where: { saveId: save.id } }),
      prisma.inventoryItem.deleteMany({ where: { saveId: save.id } }),
      prisma.companion.deleteMany({ where: { saveId: save.id } }),
      prisma.subject.deleteMany({ where: { saveId: save.id } }),
      prisma.building.deleteMany({ where: { saveId: save.id } }),
      prisma.territory.deleteMany({ where: { saveId: save.id } }),
      prisma.characterTransit.deleteMany({ where: { saveId: save.id } }),
      prisma.savedAction.deleteMany({ where: { saveId: save.id } }),
      prisma.worldState.update({
        where: { saveId: save.id },
        data: { fictionalDateLabel, facts: [], agenda: [], factionsStatus: {} },
      }),
      prisma.logEntry.create({
        data: { saveId: save.id, channel: 'CHARACTER', text: introCharacterText, timeLabel: fictionalDateLabel },
      }),
      prisma.logEntry.create({
        data: { saveId: save.id, channel: 'WORLD', text: introWorldText, timeLabel: fictionalDateLabel },
      }),
      prisma.savedAction.createMany({
        data: startingAbilitiesFor(save.characterName).map((a) => ({ ...a, saveId: save.id, isStarting: true })),
      }),
      prisma.save.update({
        where: { id: save.id },
        data: { lastPlayedAt: new Date(), level: 1, xp: 0, pendingAttributePoints: 0, kingdomName: null, profession: null },
      }),
    ]);

    return { id: save.id };
  });

  app.post<{ Params: { id: string }; Body: { attribute: Attribute } }>(
    '/saves/:id/attribute-points',
    async (request, reply) => {
      // Reparte UN punto pendiente de ascenso (ASI) en el atributo pedido (docs/10-niveles-xp-reino.md
      // § 4.2) — se llama una vez por punto, tope duro 18, nunca gasta más de lo disponible.
      const { attribute } = request.body;
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) {
        return reply.status(404).send({ error: 'Partida no encontrada' });
      }
      if (save.pendingAttributePoints <= 0) {
        return reply.status(400).send({ error: 'No quedan puntos de atributo pendientes' });
      }
      const attributes = save.attributes as AttributeBlock;
      if (attributes[attribute] >= MAX_ATTRIBUTE) {
        return reply.status(400).send({ error: `${attribute} ya está en el máximo (${MAX_ATTRIBUTE})` });
      }

      const updated = await prisma.save.update({
        where: { id: save.id },
        data: {
          pendingAttributePoints: { decrement: 1 },
          attributes: { ...attributes, [attribute]: attributes[attribute] + 1 },
        },
      });

      return { attributes: updated.attributes, pendingAttributePoints: updated.pendingAttributePoints };
    },
  );

  app.post<{ Params: { id: string }; Body: { name: string; promptText: string; icon?: string; description?: string; category?: string } }>(
    '/saves/:id/habilidades',
    async (request, reply) => {
      // Cupo por nivel (habilidadSlotsForLevel, docs/10-niveles-xp-reino.md § 4.3) solo se
      // aplica a la categoría "combate" — las generales son ilimitadas, a petición explícita
      // de la usuaria ("las de combate crecen con el nivel y las generales son infinitas").
      const { name, promptText, icon, description, category } = request.body;
      if (!name?.trim() || !promptText?.trim()) {
        return reply.status(400).send({ error: 'Faltan campos: name, promptText' });
      }
      const finalCategory = category === 'combate' ? 'combate' : 'general';

      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
        include: { savedActions: true },
      });
      if (!save) {
        return reply.status(404).send({ error: 'Partida no encontrada' });
      }

      if (finalCategory === 'combate') {
        const slots = habilidadSlotsForLevel(save.level);
        const used = save.savedActions.filter((a) => a.category === 'combate' && !a.isStarting).length;
        if (used >= slots) {
          return reply.status(400).send({ error: `No quedan huecos de combate (${slots} en nivel ${save.level})` });
        }
      }

      const created = await prisma.savedAction.create({
        data: {
          saveId: save.id,
          name: name.trim(),
          promptText: promptText.trim(),
          icon: icon?.trim() || '✨',
          description: description?.trim() || '',
          category: finalCategory,
        },
      });
      return {
        id: created.id,
        name: created.name,
        promptText: created.promptText,
        icon: created.icon,
        description: created.description,
        isStarting: created.isStarting,
        category: created.category,
      };
    },
  );

  app.post<{ Params: { id: string }; Body: { profession: string } }>('/saves/:id/profesion', async (request, reply) => {
    const { profession } = request.body;
    if (!profession?.trim()) {
      return reply.status(400).send({ error: 'Falta el campo: profession' });
    }
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    const sessionFacts = (save.worldState?.facts as string[] | undefined) ?? [];
    const fact = `${save.characterName} ejerce como ${profession}.`;

    await prisma.$transaction([
      prisma.save.update({ where: { id: save.id }, data: { profession } }),
      prisma.worldState.update({ where: { saveId: save.id }, data: { facts: mergeFacts(sessionFacts, [fact]) } }),
    ]);

    return { profession };
  });

  app.delete<{ Params: { id: string; habilidadId: string } }>(
    '/saves/:id/habilidades/:habilidadId',
    async (request, reply) => {
      await prisma.savedAction
        .deleteMany({ where: { id: request.params.habilidadId, saveId: request.params.id } })
        .catch(() => null);
      return reply.status(204).send();
    },
  );

  app.delete<{ Params: { id: string } }>('/saves/:id', async (request, reply) => {
    // onDelete: Cascade en el schema se encarga de WorldState/LogEntry/CharacterTransit/
    // InventoryItem/Companion/SessionSummary — borrar el Save basta.
    await prisma.save.delete({ where: { id: request.params.id } }).catch(() => null);
    return reply.status(204).send();
  });

  app.get('/saves', async () => {
    const userId = await getDefaultUserId();
    const saves = await prisma.save.findMany({
      where: { userId },
      include: { world: true, worldState: true },
      orderBy: { lastPlayedAt: 'desc' },
    });

    return saves.map((save) => ({
      id: save.id,
      worldId: save.world.slug,
      worldName: save.world.name,
      characterName: save.characterName,
      fictionalDate: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      lastPlayedAt: save.lastPlayedAt,
    }));
  });
}
