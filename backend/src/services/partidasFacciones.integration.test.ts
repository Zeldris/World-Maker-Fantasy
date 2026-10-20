import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { enlacesDelMundo, rutaMasCorta, TRABAJOS } from './viajeros.js';
import { cazadoresFuera, comidaDePiezas, DIAS_RESERVA_PARA_CAZAR, diasDeReservaFaccion, lanzarPartidasDeFacciones, MAX_PARTIDAS_FACCION } from './partidasFacciones.js';
import { aplicarBajas, type Cazador } from './partidasCaza.js';

/// CR-63 (63g, Q10 y Q12): las facciones cazan con partidas solo si les sobra comida.
describe('partidas de las facciones (CR-63 63g)', () => {
  let saveId: string;
  let faccionId: string;
  let worldId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const enlaces = await enlacesDelMundo(prisma, world.id);
    const lugares = await prisma.location.findMany({ where: { id: { in: [...new Set(enlaces.flatMap((e) => [e.fromId, e.toId]))] } }, select: { id: true, region: true } });
    // Casa y coto en la misma región, con camino.
    let par: [string, string] | null = null;
    for (const a of lugares) for (const b of lugares) {
      if (!par && a.id !== b.id && a.region === b.region && rutaMasCorta(enlaces, a.id, b.id)) par = [a.id, b.id];
    }
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Observadora (CR-63)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'O',
        worldState: { create: { fictionalMinutes: 10 * 1440 } },
      },
    })).id;
    faccionId = (await prisma.faction.create({
      data: {
        worldId: world.id, saveId, slug: 'clan-prueba-63g', name: 'Clan de Prueba', raza: 'orcos', description: 'x', origenSlug: 'clan-prueba',
        kingdomStats: { create: { ownerKey: `faccion-63g-${saveId}`, poblacion: 50, soldados: 10, trabajadores: 100, comida: 1000 } },
        buildings: { create: { saveId: null, locationId: par![0], recipeKey: 'cocina-serhu', name: 'Cocina', kind: 'cocina', description: 'x', status: 'ACTIVO' } },
      },
    })).id;
    await prisma.zonePoint.create({ data: { saveId, locationId: par![1], tipo: 'FAUNA', targetSlug: 'murgol', x: 1, y: 1, cantidad: 30 } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('días de reserva', () => {
    expect(diasDeReservaFaccion({ comida: 700, poblacion: 90, soldados: 10, visitantes: 0 })).toBe(7);
    expect(diasDeReservaFaccion({ comida: 0, poblacion: 0, soldados: 0, visitantes: 0 })).toBe(Infinity);
  });

  it('con comida de sobra, manda partidas de 8 al coto de su región, como mucho 4', async () => {
    for (let d = 11; d <= 16; d++) await lanzarPartidasDeFacciones(prisma, saveId, d);
    const partidas = await prisma.viajero.findMany({ where: { factionId: faccionId }, include: { miembros: true } });
    // 45 cazadores: caben 4 partidas de 8 (32) y 13 siguen en agregado.
    expect(partidas).toHaveLength(MAX_PARTIDAS_FACCION);
    expect(partidas.every((p) => p.objetivo === 'murgol' && (p.orden as { repetir: boolean }).repetir && p.miembros[0]!.genericos === 8)).toBe(true);
    expect(await prisma.$transaction((tx) => cazadoresFuera(tx, faccionId))).toBe(32);
  });

  it('al volver, sus piezas van a su comida; con poca reserva no repiten ni salen', async () => {
    const v = await prisma.viajero.findFirstOrThrow({ where: { factionId: faccionId }, include: { miembros: true } });
    await prisma.viajero.update({ where: { id: v.id }, data: { carga: { especie: 'murgol', piezas: 5, diaCaza: 12, resumen: 'x' } } });
    const antes = (await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: faccionId } })).comida;
    await prisma.$transaction(async (tx) => TRABAJOS.CAZA!.alVolver!(tx, (await tx.viajero.findUniqueOrThrow({ where: { id: v.id }, include: { miembros: true } })), 14, () => 0.5));
    const esperado = await prisma.$transaction((tx) => comidaDePiezas(tx, worldId, 'murgol', 5));
    expect(esperado).toBeGreaterThan(0);
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: faccionId } })).comida).toBe(antes + esperado);
    // Reserva por debajo de 7 días: no repite.
    await prisma.kingdomStats.updateMany({ where: { factionId: faccionId }, data: { comida: 10 } });
    const rep = await prisma.$transaction(async (tx) => TRABAJOS.CAZA!.antesDeRepetir!(tx, (await tx.viajero.findUniqueOrThrow({ where: { id: v.id }, include: { miembros: true } })), 14));
    expect(rep).toEqual({ ok: false, motivo: 'le falta comida de reserva' });
    expect(DIAS_RESERVA_PARA_CAZAR).toBe(7);
    // Y no sale ninguna nueva.
    await prisma.viajero.deleteMany({ where: { factionId: faccionId } });
    expect(await lanzarPartidasDeFacciones(prisma, saveId, 20)).toBe(0);
  });

  it('sus cazadores muertos dejan de contar en su gente y la partida mermada no repite', async () => {
    await prisma.kingdomStats.updateMany({ where: { factionId: faccionId }, data: { comida: 1000, poblacion: 50, trabajadores: 100 } });
    expect(await lanzarPartidasDeFacciones(prisma, saveId, 21)).toBe(1);
    const v = await prisma.viajero.findFirstOrThrow({ where: { factionId: faccionId }, include: { miembros: true } });
    const m = v.miembros[0]!;
    const cazadores: Cazador[] = Array.from({ length: 8 }, (_, i) => ({ miembroId: m.id, generico: true, c: { id: `${m.id}-${i}` } as Cazador['c'] }));
    await prisma.$transaction((tx) => aplicarBajas(tx, saveId, cazadores, new Map(), new Set([`${m.id}-0`, `${m.id}-1`, `${m.id}-2`]), 21, 'caza', faccionId));
    expect(await prisma.$transaction((tx) => cazadoresFuera(tx, faccionId))).toBe(5);
    expect(await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: faccionId } })).toMatchObject({ poblacion: 47, trabajadores: 97 });
    const rep = await prisma.$transaction(async (tx) => TRABAJOS.CAZA!.antesDeRepetir!(tx, (await tx.viajero.findUniqueOrThrow({ where: { id: v.id }, include: { miembros: true } })), 21));
    expect(rep).toEqual({ ok: false, motivo: 'le faltan cazadores' });
  });
});
