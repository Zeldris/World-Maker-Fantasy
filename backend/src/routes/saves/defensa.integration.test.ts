import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { ownerKeyFor } from '../../services/reinoOwner.js';
import { defensaRoutes } from './defensa.js';

/// CR-65 (65b): Reino › Defensa por HTTP.
describe('Reino › Defensa (CR-65 65b)', () => {
  let saveId: string;
  let capitalId: string;
  let armeriaId: string;
  let soldadoId: string;
  const app = Fastify();

  beforeAll(async () => {
    await app.register(defensaRoutes);
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const llanuras = (await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } })).id;
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId: world.id, characterName: 'Gorhorn (CR-65 rutas)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G' },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), riqueza: 500 } });
    capitalId = (await prisma.building.create({ data: { saveId, locationId: llanuras, recipeKey: 'ayuntamiento', name: 'Ayuntamiento', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 } })).id;
    armeriaId = (await prisma.building.create({ data: { saveId, locationId: llanuras, recipeKey: 'armeria', name: 'una armería', kind: 'armeria', description: 'x', status: 'ACTIVO', tier: 1 } })).id;
    soldadoId = (await prisma.subject.create({ data: { saveId, name: 'Brog', role: 'soldado', notes: '' } })).id;
  });
  afterAll(async () => {
    await app.close();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET devuelve la Capital con su Armería y su guarnición', async () => {
    const r = await app.inject({ method: 'GET', url: `/saves/${saveId}/defensa` });
    expect(r.statusCode).toBe(200);
    const [capital] = r.json().asentamientos;
    expect(capital).toMatchObject({ id: capitalId, capital: true, efecto: { equiposMilicia: 5 } });
    expect(capital.guarnicion[0]).toMatchObject({ id: soldadoId, rol: 'soldado' });
  });

  it('asigna guarnición y compra equipos; rechaza lo que no vale', async () => {
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/defensa/guarnicion`, payload: { subjectId: soldadoId, asentamientoId: capitalId } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/defensa/guarnicion`, payload: { subjectId: soldadoId, asentamientoId: 'otro' } })).statusCode).toBe(400);
    const c = await app.inject({ method: 'POST', url: `/saves/${saveId}/defensa/armeria/${armeriaId}/equipos`, payload: { cantidad: 2 } });
    expect(c.json()).toEqual({ ok: true, comprados: 2 });
    // Sin trabajadores no hay milicia; con uno, se arma.
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/defensa/${capitalId}/milicia` })).statusCode).toBe(400);
    await prisma.subject.create({ data: { saveId, name: 'Urk', role: 'trabajador', notes: '' } });
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/defensa/${capitalId}/milicia` })).json()).toEqual({ ok: true, armados: 1 });
  });

  it('P450: asaltosRecientes trae solo el asalto reciente de facción, sin la frase de reparar', async () => {
    await prisma.worldState.upsert({ where: { saveId }, update: { fictionalMinutes: 20000 }, create: { saveId, fictionalMinutes: 20000 } });
    const aviso = (text: string, fictionalMinutes: number) => prisma.logEntry.create({ data: { saveId, channel: 'KINGDOM', isSystemMessage: true, text, timeLabel: 'Día x', fictionalMinutes } });
    await aviso('La partida de Maktor toma Karot Veku y se lleva 3 de comida. La Empalizada ha caído: hay que repararla.', 19900);
    await aviso('La partida de caza planta cara a Múrgol en Karot Veku y no abate ninguno: 1 de los suyos sale herido y la partida se retira.', 19950);
    await aviso('La partida de Antigua toma Karot Veku y no encuentra nada que llevarse.', 1000);
    const r = await app.inject({ method: 'GET', url: `/saves/${saveId}/defensa` });
    const textos = r.json().asaltosRecientes.map((a: { texto: string }) => a.texto);
    expect(textos).toEqual(['La partida de Maktor toma Karot Veku y se lleva 3 de comida.']);
  });
});
