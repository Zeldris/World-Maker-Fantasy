import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { questsRoutes } from './quests.js';
import { GISTERA_DESPEDIDA_EN_CONVERSACION } from '../../services/dynamicMode.js';

/// P105 (QA-27): Gistera se despedía dos veces seguidas, con textos distintos: al aceptar en la
/// conversación y otra vez al aceptar la tarjeta de la misión.
describe('Aceptar la misión de Gistera tras despedirse en la conversación (P105)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: 'Gorhorn de prueba (despedida P105)', characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor', characterMotivation: 'x', portraitInitial: 'G', currentLocationId: hondonada.id,
        attributes: { fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 },
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: `Gistera se presenta…\n\n${GISTERA_DESPEDIDA_EN_CONVERSACION}`, timeLabel: 'Día 1, 08:10', fictionalMinutes: 490, isSystemMessage: true },
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('la tarjeta no añade una segunda despedida', async () => {
    const app = Fastify();
    await app.register(questsRoutes);
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/quests/aceptar`,
      payload: { title: 'Acabar con el Orco Enfurecido', description: 'Gistera Koh pidió ayuda para acabar con el guerrero que la persigue.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().logEntry.text).not.toContain('Gistera Koh asiente, aliviada');
  }, 20_000);
});
