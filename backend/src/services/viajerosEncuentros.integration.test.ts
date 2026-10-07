import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ownerKeyFor } from './reinoOwner.js';
import { avanzarViajeros, crearViajero, enlacesDelMundo, rutaMasCorta } from './viajeros.js';
import './viajerosEncuentros.js';

/// CR-63 (63f, Q8): encuentros por el camino — de fondo sin la jugadora; con ella delante, se paran y
/// pelean al día siguiente si no los ayuda.
function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}
/// La primera tirada (¿hay encuentro?) sale siempre; el resto, con la semilla.
const conEncuentro = (s: number) => {
  const r = semilla(s);
  let primera = true;
  return () => {
    if (primera) {
      primera = false;
      return 0;
    }
    return r();
  };
};

describe('encuentros por el camino (CR-63 63f)', () => {
  let saveId: string;
  let ruta: string[];

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const enlaces = await enlacesDelMundo(prisma, world.id);
    // Un primer tramo corto (se cruza el primer día) hacia un destino más lejos.
    const ids = [...new Set(enlaces.flatMap((e) => [e.fromId, e.toId]))].sort();
    let par: string[] | null = null;
    for (const a of ids) for (const b of ids) {
      if (par || a === b) continue;
      const r = rutaMasCorta(enlaces, a, b);
      const primero = r?.[0] ? enlaces.find((e) => (e.fromId === a && e.toId === r[0]) || (e.toId === a && e.fromId === r[0])) : null;
      if (r && r.length >= 2 && primero && primero.minutosBase <= 240) par = [a, ...r];
    }
    ruta = par!;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Testigo (CR-63)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'T',
        currentLocationId: ruta.at(-1)!, worldState: { create: { fictionalMinutes: 10 * 1440 } },
      },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }) } });
    for (let i = 0; i < 8; i++) await prisma.subject.create({ data: { saveId, name: `Batidor ${i}`, role: 'cazador', notes: '', pueblo: 'orcos' } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const lanzar = async (dia: number) => {
    const miembros = (await prisma.subject.findMany({ where: { saveId, estado: 'ACTIVO' } })).map((s) => ({ subjectId: s.id, rol: 'cazador' }));
    const r = await prisma.$transaction((tx) => crearViajero(tx, { saveId, tipo: 'PRUEBA-ENCUENTRO', origenLocationId: ruta[0]!, destinoLocationId: ruta.at(-1)!, dia, miembros }));
    if (!r.ok) throw new Error(r.motivo);
    return r.id;
  };

  it('sin la jugadora: pelean de fondo con la fauna agresiva del paso y avisan en el Reino', async () => {
    const grupo = await prisma.zonePoint.create({ data: { saveId, locationId: ruta[1]!, tipo: 'FAUNA', targetSlug: 'rondador-de-brasas', x: 1, y: 1, cantidad: 3 } });
    const id = await lanzar(10);
    await avanzarViajeros(prisma, saveId, 11, conEncuentro(5));
    const aviso = await prisma.logEntry.findFirst({ where: { saveId, channel: 'KINGDOM', text: { contains: 'se topa con 3 Rondador' } } });
    expect(aviso).toBeTruthy();
    const v = await prisma.viajero.findUniqueOrThrow({ where: { id } });
    // Si los rechazan siguen; si no, vuelven a casa.
    if (aviso!.text.includes('se retira')) expect(v.estado).toBe('VUELTA');
    else expect(v.estado).not.toBe('VUELTA');
    const despues = await prisma.zonePoint.findUnique({ where: { id: grupo.id } });
    expect(despues?.cantidad ?? 0).toBeLessThanOrEqual(3);
    await prisma.zonePoint.deleteMany({ where: { saveId } });
    await prisma.viajero.deleteMany({ where: { saveId } });
  });

  it('con la jugadora delante: se paran, se lo cuentan y pelean al día siguiente', async () => {
    await prisma.zonePoint.create({ data: { saveId, locationId: ruta[1]!, tipo: 'FAUNA', targetSlug: 'rondador-de-brasas', x: 1, y: 1, cantidad: 2 } });
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: ruta[1]! } });
    const id = await lanzar(20);
    await avanzarViajeros(prisma, saveId, 21, conEncuentro(9));
    const v = await prisma.viajero.findUniqueOrThrow({ where: { id } });
    expect(v.ubicacionLocationId).toBe(ruta[1]);
    expect(v.encuentro).toMatchObject({ zonePointId: expect.any(String) });
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'CHARACTER', text: { contains: 'se topa aquí con 2' } } })).toBe(1);
    // Al día siguiente, si siguen allí, pelean de fondo y el encuentro se cierra.
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: ruta[0]! } });
    await avanzarViajeros(prisma, saveId, 22, semilla(3));
    expect((await prisma.viajero.findUniqueOrThrow({ where: { id } })).encuentro).toBeNull();
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'KINGDOM', text: { contains: 'se topa con 2 Rondador' } } })).toBe(1);
  });
});
