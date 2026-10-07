import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ownerKeyFor } from './reinoOwner.js';
import { avanzarViajeros, crearViajero } from './viajeros.js';
import { prepararCaptura, SLUG_CUERDAS } from './partidasCaptura.js';

/// CR-63 (63c): la partida de captura lleva cuerdas, ata lo que abate vivo y lo deja en la Jaula.
function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

describe('partidas de captura (CR-63 63c)', () => {
  let saveId: string;
  let lugar: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Trampera (CR-63)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'T',
        worldState: { create: { fictionalMinutes: 20 * 1440 } },
      },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }) } });
    lugar = (await prisma.location.findFirstOrThrow({ where: { worldId: world.id, linksFrom: { some: {} } } })).id;
    for (let i = 0; i < 8; i++) await prisma.subject.create({ data: { saveId, name: `Trampero ${i}`, role: 'cazador', notes: '', pueblo: 'orcos' } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin Jaula o sin cuerdas no sale', async () => {
    expect(await prisma.$transaction((tx) => prepararCaptura(tx, saveId, 'murgol'))).toEqual({ ok: false, motivo: 'Necesitas una Jaula libre de su tamaño para traerlo vivo.' });
    await prisma.building.create({ data: { saveId, recipeKey: 'jaula-grande', name: 'Jaula grande', kind: 'jaula', description: 'x', status: 'ACTIVO' } });
    expect(await prisma.$transaction((tx) => prepararCaptura(tx, saveId, 'murgol'))).toEqual({ ok: false, motivo: 'No hay cuerdas en el Almacén.' });
  });

  it('ata lo que abate vivo, lo deja en la Jaula y devuelve las cuerdas que no usa', async () => {
    await prisma.almacenItem.createMany({ data: [1, 2].map(() => ({ saveId, name: 'Cuerdas', description: 'x', catalogSlug: SLUG_CUERDAS })) });
    // Una Jaula libre: se lleva una cuerda.
    const prep = await prisma.$transaction((tx) => prepararCaptura(tx, saveId, 'murgol', 3));
    expect(prep).toEqual({ ok: true, cuerdas: 1 });
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: SLUG_CUERDAS } })).toBe(1);

    let capturados = 0;
    // Con varias semillas hasta que una ate (la probabilidad es la de la especie).
    for (let s = 1; s <= 12 && capturados === 0; s++) {
      await prisma.zonePoint.deleteMany({ where: { saveId } });
      await prisma.zonePoint.create({ data: { saveId, locationId: lugar, tipo: 'FAUNA', targetSlug: 'murgol', x: 100, y: 100, cantidad: 6 } });
      const r = await prisma.$transaction(async (tx) => crearViajero(tx, { saveId, tipo: 'CAPTURA', objetivo: 'murgol', origenLocationId: lugar, destinoLocationId: lugar, dia: 20 * s, miembros: (await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' } })).map((x) => ({ subjectId: x.id, rol: 'cazador' })) }));
      if (!r.ok) throw new Error(r.motivo);
      await prisma.viajero.update({ where: { id: r.id }, data: { carga: { cuerdas: 1 } } });
      const random = semilla(s);
      for (let d = 20 * s + 1; d <= 20 * s + 3; d++) await avanzarViajeros(prisma, saveId, d, random);
      const v = await prisma.viajero.findUniqueOrThrow({ where: { id: r.id } });
      expect(v.estado).toBe('TERMINADO');
      capturados = (v.carga as { capturados: number }).capturados;
      const enJaula = await prisma.npcState.count({ where: { saveId, capturaJaulaBuildingId: { not: null } } });
      expect(enJaula).toBe(capturados);
      // La cuerda vuelve si no se usó (y en la siguiente vuelta del bucle se vuelve a llevar).
      if (capturados === 0) expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: SLUG_CUERDAS } })).toBe(2);
    }
    expect(capturados).toBe(1);
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'atado en la Jaula' } } })).toBe(1);
  });
});
