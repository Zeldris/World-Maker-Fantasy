import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ganadoRoutes } from '../routes/saves/ganado.js';
import { edificiosParaCliente } from './edificiosParaCliente.js';

/// P346: el atado de la Jaula grande (`NpcState.capturaJaulaBuildingId`) tiene que llegar a la tarjeta de la Jaula
/// (Reino › Edificios) y a Reino › Corrales. P219-style: el mismo constructor sirve a GET /saves/:id y a un turno.
describe('P346 — el atado de la Jaula llega al cliente', () => {
  let saveId: string;
  let jaulaGrandeId: string;
  let jaulaVaciaId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const corretolvas = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'corretolvas', saveId: null } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Atadora de prueba (P346)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Serhu',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'A',
        worldState: { create: { fictionalMinutes: 10 * 1440, fictionalDateLabel: 'día 10' } },
      },
    });
    saveId = save.id;
    jaulaGrandeId = (await prisma.building.create({ data: { saveId, recipeKey: 'jaula-grande', name: 'Jaula grande', kind: 'jaula-grande', status: 'ACTIVO', description: 'x' } })).id;
    jaulaVaciaId = (await prisma.building.create({ data: { saveId, recipeKey: 'jaula-pequena', name: 'Jaula pequeña', kind: 'jaula-pequena', status: 'ACTIVO', description: 'x' } })).id;
    await prisma.npcState.create({ data: { saveId, npcId: corretolvas.id, scope: '', condicionFisica: 'ILESO', capturado: true, capturaFelicidad: 15, capturaJaulaBuildingId: jaulaGrandeId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('la ficha del edificio trae el ocupante de la Jaula ocupada y null en la vacía', async () => {
    const filas = await prisma.building.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } });
    const fichas = await edificiosParaCliente(prisma, saveId, filas);
    expect(fichas.find((f) => f.id === jaulaGrandeId)?.ocupante).toEqual({ npcSlug: 'corretolvas', name: expect.any(String), tipo: 'FAUNA', felicidad: 15 });
    expect(fichas.find((f) => f.id === jaulaVaciaId)?.ocupante).toBeNull();
  });

  it('GET /corrales lista las Jaulas con su atado', async () => {
    const app = Fastify();
    await app.register(ganadoRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/corrales` });
    expect(res.statusCode).toBe(200);
    const jaulas = res.json().jaulas as { id: string; tamano: string; ocupante: { npcSlug: string; felicidad: number } | null }[];
    expect(jaulas).toHaveLength(2);
    expect(jaulas.find((j) => j.id === jaulaGrandeId)).toMatchObject({ tamano: 'GRANDE', ocupante: { npcSlug: 'corretolvas', felicidad: 15 } });
    expect(jaulas.find((j) => j.id === jaulaVaciaId)?.ocupante).toBeNull();
  });
});
