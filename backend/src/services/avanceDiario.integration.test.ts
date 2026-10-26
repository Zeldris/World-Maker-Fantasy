import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { avanzarMundoHasta, registrarAvanceTrasAcciones } from './avanceDiario.js';
import { SUCESOS_DE_FONDO } from './cronista/narradorFondo.js';

// CR-7 (hito 0.2, roadmap-cronista.md § 13.1) — el mundo de una partida avanza con SU reloj, contra
// Postgres real: crece su población (no la de otra partida ni la del catálogo) y cada día se
// simula una sola vez.
describe('avanzarMundoHasta (CR-7)', () => {
  const saveIds: string[] = [];
  let worldId: string;

  async function crearPartida(nombre: string) {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId,
        characterName: nombre,
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: 480, fictionalDateLabel: 'Día 1, mañana' } },
      },
    });
    saveIds.push(save.id);
    return save.id;
  }

  const totalPoblacion = async (where: { saveId: string } | { worldId: string; saveId: null }) =>
    (await prisma.worldPopulation.aggregate({ where, _sum: { poblacion: true } }))._sum.poblacion ?? 0;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('diez días hacen crecer la población de la partida, no la de otra ni la del catálogo; repetir no vuelve a simular', async () => {
    const a = await crearPartida('Avance diario (CR-7) A');
    const b = await crearPartida('Avance diario (CR-7) B');
    // Clonar las dos antes de medir (la primera llamada de cada una ya clona).
    await avanzarMundoHasta(prisma, a, 480);
    await avanzarMundoHasta(prisma, b, 480);
    const antesA = await totalPoblacion({ saveId: a });
    const antesB = await totalPoblacion({ saveId: b });
    const antesCatalogo = await totalPoblacion({ worldId, saveId: null });

    const diezDias = 480 + 10 * 1440;
    expect(await avanzarMundoHasta(prisma, a, diezDias, () => 0)).toEqual({ diasSimulados: 10 });

    expect(await totalPoblacion({ saveId: a })).toBeGreaterThan(antesA);
    expect(await totalPoblacion({ saveId: b })).toBe(antesB);
    expect(await totalPoblacion({ worldId, saveId: null })).toBe(antesCatalogo);
    expect((await prisma.worldState.findUniqueOrThrow({ where: { saveId: a } })).ultimoDiaSimulado).toBe(10);
    // CR-12: el narrador de fondo ha pasado por esos días (en la otra partida, no).
    const deFondoWhere = { origen: 'MUNDO' as const, tipo: { in: SUCESOS_DE_FONDO.map((e) => e.tipo) } };
    const deFondo = await prisma.suceso.count({ where: { saveId: a, ...deFondoWhere } });
    expect(deFondo).toBeGreaterThan(0);
    expect(await prisma.suceso.count({ where: { saveId: b, ...deFondoWhere } })).toBe(0);

    const tras = await totalPoblacion({ saveId: a });
    expect(await avanzarMundoHasta(prisma, a, diezDias, () => 0)).toEqual({ diasSimulados: 0 });
    expect(await totalPoblacion({ saveId: a })).toBe(tras);
    expect(await prisma.suceso.count({ where: { saveId: a, ...deFondoWhere } })).toBe(deFondo);
  }, 30_000);

  it('la economía avanza las copias de la partida con su reloj y deja quietas las del catálogo', async () => {
    const a = await crearPartida('Avance diario (CR-7) economía');
    await avanzarMundoHasta(prisma, a, 480);
    const copias = await prisma.kingdomStats.findMany({ where: { faction: { saveId: a, origenSlug: { not: null } } } });
    expect(copias.length).toBeGreaterThan(0);
    // Al clonar, los marcadores arrancan en el día de la partida (0), no en el del mundo.
    expect(copias.every((k) => k.ultimoDiaProducido === 0 && k.ultimoDiaExpedicion === 0)).toBe(true);
    const catalogoAntes = await prisma.kingdomStats.findMany({ where: { faction: { worldId, saveId: null } }, select: { id: true, ultimoDiaProducido: true, comida: true }, orderBy: { id: 'asc' } });

    await avanzarMundoHasta(prisma, a, 480 + 3 * 1440, () => 0);

    const copiasTras = await prisma.kingdomStats.findMany({ where: { faction: { saveId: a, origenSlug: { not: null } } } });
    expect(copiasTras.every((k) => k.ultimoDiaProducido === 3)).toBe(true);
    const catalogoTras = await prisma.kingdomStats.findMany({ where: { faction: { worldId, saveId: null } }, select: { id: true, ultimoDiaProducido: true, comida: true }, orderBy: { id: 'asc' } });
    // Con orderBy: sin él, Postgres puede devolver las mismas filas en otro orden y el toEqual falla.
    expect(catalogoTras).toEqual(catalogoAntes);
  }, 30_000);

  it('una acción que mueve el reloj fuera del turno (POST /saves/:id/...) también avanza el mundo', async () => {
    const a = await crearPartida('Avance diario (CR-7) tras acción');
    const app = Fastify();
    registrarAvanceTrasAcciones(app, prisma);
    // Acción de prueba: como descansar, adelanta el reloj dos días.
    app.post<{ Params: { id: string } }>('/saves/:id/accion-de-prueba', async (request) => {
      await prisma.worldState.update({ where: { saveId: request.params.id }, data: { fictionalMinutes: 480 + 2 * 1440 } });
      return { ok: true };
    });
    const res = await app.inject({ method: 'POST', url: `/saves/${a}/accion-de-prueba` });
    expect(res.statusCode).toBe(200);
    // El gancho va tras enviar la respuesta. Avanzar dos días tarda ~0,8 s y con la suite entera pasaba del segundo
    // que espera `vi.waitFor` por defecto (CI local, 2026-10-26).
    await vi.waitFor(async () => {
      expect((await prisma.worldState.findUniqueOrThrow({ where: { saveId: a } })).ultimoDiaSimulado).toBe(2);
    }, { timeout: 15_000 });
    await app.close();
  }, 30_000);
});
