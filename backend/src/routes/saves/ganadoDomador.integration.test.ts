import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { ganadoRoutes } from './ganado.js';

/// CR-56 (Q4): la jugadora Domadora se lleva un Canizor adulto del corral y lo devuelve tal cual.
const AHORA = 400 * 1440;

describe('Domadora: llevar contigo y devolver al corral (CR-56 56b)', () => {
  let saveId: string;
  let corralId: string;
  async function buildApp() {
    const app = Fastify();
    await app.register(ganadoRoutes);
    return app;
  }

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Domadora de prueba', characterArchetype: 'cazador', characterOrigin: 'Clan Serhu', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'D',
        clase: 'CAZADOR', especializacion: 'DOMADOR', level: 5,
        worldState: { create: { fictionalMinutes: AHORA } },
      },
    })).id;
    corralId = (await prisma.building.create({ data: { saveId, recipeKey: 'corrales', name: 'Corral', kind: 'ganadero-orcos-llanuras', status: 'ACTIVO', description: 'x', tier: 1 } })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un Canizor adulto sale del corral como compañero de Domador y vuelve con su sexo y su edad', async () => {
    const adulto = await prisma.ganado.create({ data: { saveId, buildingId: corralId, especie: 'canizor', sexo: 'F', nacidoEn: AHORA - 300 * 1440 } });
    const app = await buildApp();
    const corrales = (await app.inject({ method: 'GET', url: `/saves/${saveId}/corrales` })).json();
    expect(corrales.corrales[0].guardia).toBe(true);
    expect(corrales.corrales[0].animales[0].puedeLlevar).toBe(true);

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/ganado/${adulto.id}/llevar` });
    expect(res.statusCode).toBe(200);
    const c = await prisma.companion.findUniqueOrThrow({ where: { id: res.json().companionId } });
    expect(c).toMatchObject({ tipo: 'FAUNA', sourceSlug: 'canizor', esSlotDomador: true, sexo: 'F' });
    expect(await prisma.ganado.count({ where: { saveId } })).toBe(0);
    // Un Domador de nivel 5 solo guía a uno: el segundo no sale.
    const otro = await prisma.ganado.create({ data: { saveId, buildingId: corralId, especie: 'canizor', sexo: 'M', nacidoEn: AHORA - 300 * 1440 } });
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/ganado/${otro.id}/llevar` })).statusCode).toBe(400);

    expect((await app.inject({ method: 'GET', url: `/saves/${saveId}/corrales` })).json().fueraDelCorral).toEqual([{ id: c.id, name: c.name }]);
    // Revisión del PR: muerto no vuelve (ni sale en la lista).
    await prisma.companion.update({ where: { id: c.id }, data: { condicionFisica: 'MUERTO' } });
    expect((await app.inject({ method: 'GET', url: `/saves/${saveId}/corrales` })).json().fueraDelCorral).toEqual([]);
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/companeros/${c.id}/al-corral` })).statusCode).toBe(400);
    await prisma.companion.update({ where: { id: c.id }, data: { condicionFisica: 'ILESO' } });
    const vuelta = await app.inject({ method: 'POST', url: `/saves/${saveId}/companeros/${c.id}/al-corral` });
    expect(vuelta.statusCode).toBe(200);
    // P352: el mismo aviso y la misma línea en el diario del Reino que el «Al corral» de un animal recién domado (P349).
    const especie = (await prisma.npc.findFirstOrThrow({ where: { saveId: null, slug: 'canizor' }, select: { name: true } })).name;
    expect(vuelta.json().aviso).toBe(`El ${especie} entra en los Corrales del Ganadero.`);
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'KINGDOM', text: `El ${especie} entra en los Corrales del Ganadero.` } })).toBe(1);
    const devuelto = await prisma.ganado.findFirstOrThrow({ where: { saveId, sexo: 'F' } });
    expect(devuelto.nacidoEn).toBe(AHORA - 300 * 1440);
    expect(await prisma.companion.count({ where: { saveId } })).toBe(0);
  });

  it('una cría o un animal que no sirve de compañero no sale', async () => {
    const cria = await prisma.ganado.create({ data: { saveId, buildingId: corralId, especie: 'canizor', sexo: 'F', nacidoEn: AHORA - 5 * 1440 } });
    const app = await buildApp();
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/ganado/${cria.id}/llevar` })).statusCode).toBe(400);
  });
});
