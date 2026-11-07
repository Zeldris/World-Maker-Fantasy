import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { companerosRoutes } from './companeros.js';
import { ganadoRoutes } from './ganado.js';
import { ownerKeyFor } from '../../services/reinoOwner.js';

/// CR-55 (55c): el Múrgol domesticado va al corral, la especie se puede volver a capturar, un corral
/// guarda una sola especie y los pastos se entregan como forraje.
async function buildApp() {
  const app = Fastify();
  await app.register(companerosRoutes);
  await app.register(ganadoRoutes);
  return app;
}

describe('Ganado del Reino: al corral y forraje (CR-55 55c)', () => {
  let saveId: string;
  let murgolId: string;
  let corretolvasId: string;
  let corralId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    murgolId = (await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'murgol', saveId: null } })).id;
    corretolvasId = (await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'corretolvas', saveId: null } })).id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Ganadera de prueba (CR-55)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Serhu',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: 10 * 1440, fictionalDateLabel: 'día 10' } },
      },
    });
    saveId = save.id;
    await prisma.kingdomStats.create({ data: { ownerKey: ownerKeyFor({ saveId }), saveId, comida: 20 } });
    corralId = (await prisma.building.create({ data: { saveId, recipeKey: 'corrales', name: 'Corrales del Ganadero', kind: 'ganadero-orcos-llanuras', status: 'ACTIVO', description: 'x', tier: 1 } })).id;
    await prisma.npcState.create({ data: { saveId, npcId: murgolId, scope: '', condicionFisica: 'ILESO', capturado: true, capturaFelicidad: 90 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('P347: sin un Corral del Ganadero en pie el pendiente lo dice (hayCorral false) y con él, true', async () => {
    const app = await buildApp();
    await prisma.building.update({ where: { id: corralId }, data: { status: 'DANADO' } });
    const sin = await app.inject({ method: 'GET', url: `/saves/${saveId}/tameo-pendientes` });
    expect(sin.json().pendientes.find((p: { npcSlug: string }) => p.npcSlug === 'murgol')?.hayCorral).toBe(false);
    await prisma.building.update({ where: { id: corralId }, data: { status: 'ACTIVO' } });
    const con = await app.inject({ method: 'GET', url: `/saves/${saveId}/tameo-pendientes` });
    expect(con.json().pendientes.find((p: { npcSlug: string }) => p.npcSlug === 'murgol')?.hayCorral).toBe(true);
  });

  it('el Múrgol domesticado entra al corral y su especie se puede volver a capturar', async () => {
    const app = await buildApp();
    const pendientes = await app.inject({ method: 'GET', url: `/saves/${saveId}/tameo-pendientes` });
    expect(pendientes.json().pendientes.find((p: { npcSlug: string }) => p.npcSlug === 'murgol')?.alCorral).toBe(true);

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/murgol/al-corral`, payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json().buildingId).toBe(corralId);
    // P349: el aviso para la pantalla y la misma línea en el diario del Reino.
    expect(res.json().aviso).toBe('El Múrgol entra en los Corrales del Ganadero.');
    const linea = await prisma.logEntry.findFirst({ where: { saveId, channel: 'KINGDOM', text: 'El Múrgol entra en los Corrales del Ganadero.' } });
    expect(linea).not.toBeNull();
    const animal = await prisma.ganado.findFirstOrThrow({ where: { saveId } });
    expect(animal.especie).toBe('murgol');
    // Recién adulto: un año o algo más.
    expect(10 * 1440 - animal.nacidoEn).toBeGreaterThanOrEqual(120 * 1440);
    const estado = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: murgolId } });
    expect(estado.capturado).toBe(false);
    expect(await prisma.companion.count({ where: { saveId } })).toBe(0);

    const corrales = (await app.inject({ method: 'GET', url: `/saves/${saveId}/corrales` })).json();
    expect(corrales.corrales[0].especie).toBe('murgol');
    expect(corrales.corrales[0].plazas).toBe(6);
    expect(corrales.corrales[0].animales[0].etapa).toBe('ADULTO');
  });

  it('dos «Al corral» a la vez de una sola captura meten un solo animal (revisión del PR)', async () => {
    await prisma.npcState.updateMany({ where: { saveId, npcId: murgolId }, data: { capturado: true, capturaFelicidad: 90 } });
    const app = await buildApp();
    const antes = await prisma.ganado.count({ where: { saveId } });
    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/murgol/al-corral`, payload: {} }),
      app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/murgol/al-corral`, payload: {} }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 400]);
    expect(await prisma.ganado.count({ where: { saveId } })).toBe(antes + 1);
  });

  it('un animal ya confirmado como compañero no va además al corral', async () => {
    await prisma.npcState.updateMany({ where: { saveId, npcId: murgolId }, data: { capturado: true, capturaFelicidad: 90 } });
    const c = await prisma.companion.create({ data: { saveId, name: 'Múrgol', role: 'mascota', notes: '', tipo: 'FAUNA', sourceSlug: 'murgol' } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/murgol/al-corral`, payload: {} });
    expect(res.statusCode).toBe(400);
    await prisma.companion.delete({ where: { id: c.id } });
    await prisma.npcState.updateMany({ where: { saveId, npcId: murgolId }, data: { capturado: false, capturaFelicidad: 0 } });
  });

  it('un corral guarda una sola especie: el Corretolvas no cabe en el de Múrgol', async () => {
    await prisma.npcState.create({ data: { saveId, npcId: corretolvasId, scope: '', condicionFisica: 'ILESO', capturado: true, capturaFelicidad: 90 } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/corretolvas/al-corral`, payload: {} });
    expect(res.statusCode).toBe(409);
    expect(await prisma.ganado.count({ where: { saveId, especie: 'corretolvas' } })).toBe(0);
  });

  it('el pendiente que ningún corral admite lo dice (motivoCorral) en vez de salir con «Al corral» activo y dar 409', async () => {
    const app = await buildApp();
    const lista = (await app.inject({ method: 'GET', url: `/saves/${saveId}/tameo-pendientes` })).json().pendientes as { npcSlug: string; hayCorral: boolean; motivoCorral: string | null }[];
    const corretolvas = lista.find((p) => p.npcSlug === 'corretolvas');
    // Hay corral en pie (hayCorral), pero el único guarda Múrgoles: el motivo es el mismo que daría el 409.
    expect(corretolvas?.hayCorral).toBe(true);
    expect(corretolvas?.motivoCorral).toMatch(/No hay plaza/);
  });

  it('el aviso de entrada lleva el artículo de la especie: «La Salamandra de Escoria», no «El Salamandra…»', async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const salamandra = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'salamandra-de-escoria', saveId: null } });
    await prisma.building.create({ data: { saveId, recipeKey: 'corrales', name: 'Corrales del Ganadero', kind: 'ganadero-orcos-llanuras', status: 'ACTIVO', description: 'x', tier: 1 } });
    await prisma.npcState.create({ data: { saveId, npcId: salamandra.id, scope: '', condicionFisica: 'ILESO', capturado: true, capturaFelicidad: 90 } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/salamandra-de-escoria/al-corral`, payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json().aviso).toBe('La Salamandra de Escoria entra en los Corrales del Ganadero.');
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'KINGDOM', text: 'La Salamandra de Escoria entra en los Corrales del Ganadero.' } })).toBe(1);
  });

  it('cada pasto entregado da 2 de forraje, hasta el tope compartido con la comida', async () => {
    await prisma.inventoryItem.createMany({ data: Array.from({ length: 3 }, () => ({ saveId, name: 'Pasto Solar', description: 'x', catalogSlug: 'pasto-solar' })) });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/forraje/entregar`, payload: { catalogSlug: 'pasto-solar' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ entregados: 3, forraje: 6 });
    expect(await prisma.inventoryItem.count({ where: { saveId, catalogSlug: 'pasto-solar' } })).toBe(0);
    // Sin Granero: tope 60, menos 20 de comida y 6 de forraje.
    expect((await app.inject({ method: 'GET', url: `/saves/${saveId}/corrales` })).json().huecoForraje).toBe(34);
  });

  it('sacrificar un Múrgol adulto: la carne a la comida y, sin Desolladero, el hueso a la mitad', async () => {
    const app = await buildApp();
    const animal = await prisma.ganado.findFirstOrThrow({ where: { saveId, especie: 'murgol' } });
    const antes = (await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: ownerKeyFor({ saveId }) } })).comida;
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/ganado/${animal.id}/sacrificar` });
    expect(res.statusCode).toBe(200);
    // 3 raciones de carne (10 de curaHambre cada una) = 3 de comida; 4 huesos → 2; la lana (1) → 0.
    expect(res.json()).toMatchObject({ comida: 3, almacen: { 'hueso-ligero': 2 } });
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: ownerKeyFor({ saveId }) } })).comida).toBe(antes + 3);
    expect(await prisma.ganado.findUnique({ where: { id: animal.id } })).toBeNull();
  });

  it('una cría no se puede sacrificar', async () => {
    const cria = await prisma.ganado.create({ data: { saveId, buildingId: corralId, especie: 'murgol', sexo: 'F', nacidoEn: 10 * 1440 - 5 * 1440 } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/ganado/${cria.id}/sacrificar` });
    expect(res.statusCode).toBe(400);
  });

  it('P330: el aviso de carencia solo cuenta con animales en los corrales (sin ellos, 0 días)', async () => {
    const owner = ownerKeyFor({ saveId });
    await prisma.kingdomStats.update({ where: { ownerKey: owner }, data: { ganadoDiasSinComer: 4, ganadoDiasSinBeber: 2 } });
    const app = await buildApp();
    const con = (await app.inject({ method: 'GET', url: `/saves/${saveId}/corrales` })).json();
    expect(con.diasSinComer).toBe(4);
    expect(con.diasSinBeber).toBe(2);
    await prisma.ganado.deleteMany({ where: { saveId } });
    const sin = (await app.inject({ method: 'GET', url: `/saves/${saveId}/corrales` })).json();
    expect(sin.diasSinComer).toBe(0);
    expect(sin.diasSinBeber).toBe(0);
  });
});
