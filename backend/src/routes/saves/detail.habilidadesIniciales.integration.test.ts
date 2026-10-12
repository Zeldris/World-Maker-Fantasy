import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { detailRoutes } from './detail.js';
import { startingAbilitiesFor } from '../../services/startingAbilities.js';

/// P67 (QA-27): la descripción de una habilidad inicial la manda el catálogo; una partida creada
/// con el texto viejo de «Viajar» («todavía sin implementar») recoge el nuevo al leerse.
describe('GET /saves/:id resincroniza la descripción de las habilidades iniciales (P67)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.savedAction.create({
      data: { saveId, name: 'Viajar', promptText: 'x', category: 'general', icon: '🧭', isStarting: true, description: 'Requiere montura (todavía sin implementar) — por ahora…' },
    });
    await prisma.savedAction.create({ data: { saveId, name: 'Analisis Salvaje', promptText: 'x', category: 'combate', icon: '🔎', description: 'x' } });
    await prisma.save.update({ where: { id: saveId }, data: { activeCombatAbilityNames: ['Analisis Salvaje'], activeCombatAbilityNamesConfigured: true } });
  });

  afterAll(async () => {
    await prisma.skillBar.deleteMany({ where: { saveId } });
    await prisma.savedAction.deleteMany({ where: { saveId } });
    await prisma.worldState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('«Viajar» ya no enseña «todavía sin implementar»', async () => {
    const app = Fastify();
    await app.register(detailRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(res.statusCode).toBe(200);
    const viajar = (res.json() as { savedActions: { name: string; description: string }[] }).savedActions.find((a) => a.name === 'Viajar');
    const catalogo = startingAbilitiesFor('Gorhorn').find((a) => a.name === 'Viajar');
    expect(viajar?.description).toBe(catalogo?.description);
    expect(viajar?.description).not.toMatch(/sin implementar/);
  });

  it('P100: «Analisis Salvaje» pasa a «Análisis Salvaje», también en las activas de combate', async () => {
    const app = Fastify();
    await app.register(detailRoutes);
    await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    const nombres = (await prisma.savedAction.findMany({ where: { saveId, category: 'combate' } })).map((a) => a.name);
    expect(nombres).toContain('Análisis Salvaje');
    expect(nombres).not.toContain('Analisis Salvaje');
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).activeCombatAbilityNames).toEqual(['Análisis Salvaje']);
  });
});
