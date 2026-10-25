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
    await prisma.skillBar.create({ data: { saveId, slotIndex: 0, name: 'Barra 1', abilityNames: ['Viajar', 'Analisis Salvaje'] } });
    // QA-68: el contador de usos por combate también guarda nombres de habilidad.
    const guchapo = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'guchapo' } });
    await prisma.npcState.create({ data: { saveId, npcId: guchapo.id, scope: hondonada.id, abilityUsesThisEncounter: { 'Analisis Salvaje': 1, Mordisco: 2 } } });
  });

  afterAll(async () => {
    await prisma.npcState.deleteMany({ where: { saveId } });
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

  it('P100: «Analisis Salvaje» pasa a «Análisis Salvaje», también en las activas de combate, las barras y los usos por combate', async () => {
    const app = Fastify();
    await app.register(detailRoutes);
    await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    const nombres = (await prisma.savedAction.findMany({ where: { saveId, category: 'combate' } })).map((a) => a.name);
    expect(nombres).toContain('Análisis Salvaje');
    expect(nombres).not.toContain('Analisis Salvaje');
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).activeCombatAbilityNames).toEqual(['Análisis Salvaje']);
    expect((await prisma.skillBar.findFirstOrThrow({ where: { saveId, slotIndex: 0 } })).abilityNames).toEqual(['Viajar', 'Análisis Salvaje']);
    expect((await prisma.npcState.findFirstOrThrow({ where: { saveId } })).abilityUsesThisEncounter).toEqual({ 'Análisis Salvaje': 1, Mordisco: 2 });
  });
});

/// QA-240: habilidades que se repetían entre clases, renombradas según la clase de la partida. Un
/// Asesino Selecto tenía dos «Golpe Certero» (tronco y rama); cada fila recoge el suyo.
describe('GET /saves/:id renombra por clase las habilidades repetidas (QA-240)', () => {
  let saveId: string;
  const TRONCO = 'Un golpe reactivo, soltado en el instante exacto en que el rival baja la guardia.';
  const RAMA = 'Un golpe directo al objetivo marcado, sin desperdiciar ni un movimiento.';

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Selecta',
        characterArchetype: 'asesino',
        characterOrigin: 'x',
        characterMotivation: 'x',
        attributes: { fuerza: 8, destreza: 12, constitucion: 7, inteligencia: 8, voluntad: 7, carisma: 6, magia: 2 },
        portraitInitial: 'S',
        currentLocationId: hondonada.id,
        clase: 'ASESINO',
        especializacion: 'ASESINO_SELECTO',
        level: 32,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.savedAction.create({ data: { saveId, name: 'Golpe Certero', promptText: 'x', category: 'combate', icon: '🗡️', description: TRONCO } });
    await prisma.savedAction.create({ data: { saveId, name: 'Golpe Certero', promptText: 'x', category: 'combate', icon: '🎯', description: RAMA } });
    await prisma.skillBar.create({ data: { saveId, slotIndex: 0, name: 'Barra 1', abilityNames: ['Golpe Certero'] } });
  });

  afterAll(async () => {
    await prisma.skillBar.deleteMany({ where: { saveId } });
    await prisma.savedAction.deleteMany({ where: { saveId } });
    await prisma.worldState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el del tronco pasa a «Golpe Oportuno» y el de la rama a «Golpe a la Marca», sin duplicarse', async () => {
    const app = Fastify();
    await app.register(detailRoutes);
    expect((await app.inject({ method: 'GET', url: `/saves/${saveId}` })).statusCode).toBe(200);
    const nombres = (await prisma.savedAction.findMany({ where: { saveId, category: 'combate' } })).map((a) => a.name);
    expect(nombres).not.toContain('Golpe Certero');
    expect(nombres.filter((n) => n === 'Golpe Oportuno')).toHaveLength(1);
    expect(nombres.filter((n) => n === 'Golpe a la Marca')).toHaveLength(1);
    expect((await prisma.skillBar.findFirstOrThrow({ where: { saveId, slotIndex: 0 } })).abilityNames).toEqual(['Golpe Oportuno']);
  });
});
