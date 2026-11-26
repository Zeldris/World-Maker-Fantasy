import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { enlacesDelMundo, rutaMasCorta, TRABAJOS } from './viajeros.js';
import { lanzarAcopiosDeFacciones, PORTEADORES_POR_PARTIDA } from './partidasAcopio.js';

/// CR-36b (Q-40, Q-41): una facción con la obra parada por piedra manda una partida de acopio.
describe('partidas de acopio de las facciones (CR-36b)', () => {
  let saveId: string;
  let faccionId: string;
  let cerca: string;
  let lejos: string;
  const FUENTE = 'roca-luclara';

  const recargar = (id: string) => prisma.viajero.findUniqueOrThrow({ where: { id }, include: { miembros: true } });

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const enlaces = await enlacesDelMundo(prisma, world.id);
    const lugares = await prisma.location.findMany({ where: { id: { in: [...new Set(enlaces.flatMap((e) => [e.fromId, e.toId]))] } }, select: { id: true, region: true }, orderBy: { id: 'asc' } });
    // Casa y dos zonas de su región con camino, una a menos tramos que la otra.
    let t: [string, string, string] | null = null;
    for (const a of lugares) {
      const mismos = lugares.filter((b) => b.id !== a.id && b.region === a.region).map((b) => ({ id: b.id, n: rutaMasCorta(enlaces, a.id, b.id)?.length ?? 0 })).filter((x) => x.n > 0).sort((x, y) => x.n - y.n);
      if (!t && mismos.length >= 2 && mismos[0]!.n < mismos.at(-1)!.n) t = [a.id, mismos[0]!.id, mismos.at(-1)!.id];
    }
    const [casa, c, l] = t!;
    cerca = c;
    lejos = l;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Observadora (CR-36b)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'O',
        worldState: { create: { fictionalMinutes: 10 * 1440 } },
      },
    })).id;
    faccionId = (await prisma.faction.create({
      data: {
        worldId: world.id, saveId, slug: 'clan-prueba-36b', name: 'Clan de Acopio', raza: 'orcos', description: 'x', origenSlug: 'clan-prueba-acopio',
        kingdomStats: { create: { ownerKey: `faccion-36b-${saveId}`, poblacion: 50, soldados: 10, trabajadores: 100, comida: 1000 } },
        buildings: { create: { saveId: null, locationId: casa, recipeKey: 'cocina-serhu', name: 'Cocina', kind: 'cocina', description: 'x', status: 'ACTIVO' } },
      },
    })).id;
    // La obra (un Pozo: 6 de leña y 6 de piedra) tiene la leña y le falta la piedra.
    await prisma.obraFaccion.create({ data: { factionId: faccionId, saveId, recipeKey: 'pozo', tier: 1, dias: 1, aviso: 'Faltan materiales en el Almacén: 6 de piedra.' } });
    await prisma.almacenItem.createMany({ data: Array.from({ length: 6 }, () => ({ factionId: faccionId, name: 'Leña', description: 'x', catalogSlug: 'madera-telda' })) });
    await prisma.zonePoint.create({ data: { saveId, locationId: cerca, tipo: 'RECURSO', targetSlug: FUENTE, x: 1, y: 1, cantidad: 100 } });
    await prisma.zonePoint.create({ data: { saveId, locationId: lejos, tipo: 'RECURSO', targetSlug: FUENTE, x: 1, y: 1, cantidad: 100 } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('con la obra parada por piedra, sale un acopio con 8 porteadores a la zona más cercana con piedra', async () => {
    expect(await lanzarAcopiosDeFacciones(prisma, saveId, 11)).toBe(1);
    const v = await prisma.viajero.findFirstOrThrow({ where: { factionId: faccionId }, include: { miembros: true } });
    expect(v).toMatchObject({ tipo: 'ACOPIO', objetivo: 'piedra', destinoLocationId: cerca });
    const porteadores = v.miembros.filter((m) => m.rol === 'porteador');
    expect(porteadores.map((m) => m.genericos)).toEqual([PORTEADORES_POR_PARTIDA]);
    // Los guardias (0 o 2 según el riesgo de la ruta real) salen de los soldados.
    const guardias = v.miembros.filter((m) => m.rol === 'guardia').reduce((s, m) => s + m.genericos, 0);
    expect([0, 2, 4]).toContain(guardias);
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: faccionId } })).soldados).toBe(10 - guardias);
  });

  it('no sale un segundo acopio mientras el primero está en marcha', async () => {
    expect(await lanzarAcopiosDeFacciones(prisma, saveId, 12)).toBe(0);
    expect(await prisma.viajero.count({ where: { factionId: faccionId, tipo: 'ACOPIO' } })).toBe(1);
  });

  it('al llegar resta del punto y al volver hay una fila por unidad en el Almacén de la facción', async () => {
    const v = await prisma.viajero.findFirstOrThrow({ where: { factionId: faccionId }, include: { miembros: true } });
    await prisma.viajero.update({ where: { id: v.id }, data: { ubicacionLocationId: cerca, estado: 'TRABAJANDO' } });
    await prisma.$transaction(async (tx) => TRABAJOS.ACOPIO!.alLlegar!(tx, await recargar(v.id), 13, () => 0.5));
    // 8 porteadores × 10 = 80 de los 100.
    expect((await prisma.zonePoint.findFirstOrThrow({ where: { saveId, locationId: cerca } })).cantidad).toBe(20);
    expect((await prisma.zonePoint.findFirstOrThrow({ where: { saveId, locationId: lejos } })).cantidad).toBe(100);
    const carga = (await recargar(v.id)).carga as { categoria: string; items: { slug: string; n: number }[] };
    expect(carga.categoria).toBe('piedra');
    expect(carga.items.reduce((s, i) => s + i.n, 0)).toBe(80);
    const antes = await prisma.almacenItem.count({ where: { factionId: faccionId } });
    await prisma.$transaction(async (tx) => TRABAJOS.ACOPIO!.alVolver!(tx, await recargar(v.id), 14, () => 0.5));
    expect(await prisma.almacenItem.count({ where: { factionId: faccionId } })).toBe(antes + 80);
    expect(await prisma.almacenItem.count({ where: { saveId } })).toBe(0);
  });

  it('un punto que se agota queda inactivo, y los guardias que vuelven se devuelven a la guarnición', async () => {
    const v = await prisma.viajero.findFirstOrThrow({ where: { factionId: faccionId }, include: { miembros: true } });
    await prisma.viajeroMiembro.deleteMany({ where: { viajeroId: v.id, rol: 'guardia' } });
    await prisma.viajeroMiembro.create({ data: { viajeroId: v.id, genericos: 2, rol: 'guardia' } });
    await prisma.kingdomStats.updateMany({ where: { factionId: faccionId }, data: { soldados: 8 } });
    await prisma.$transaction(async (tx) => TRABAJOS.ACOPIO!.alLlegar!(tx, await recargar(v.id), 15, () => 0.5));
    const p = await prisma.zonePoint.findFirstOrThrow({ where: { saveId, locationId: cerca } });
    expect(p).toMatchObject({ cantidad: 0, activo: false });
    await prisma.$transaction(async (tx) => TRABAJOS.ACOPIO!.alVolver!(tx, await recargar(v.id), 16, () => 0.5));
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: faccionId } })).soldados).toBe(10);
  });
});
