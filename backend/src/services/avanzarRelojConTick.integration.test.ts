import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ownerKeyFor } from './reinoOwner.js';
import { avanzarRelojConTick } from './dailyTick.js';

/// P216/P217: todo avance de reloj fuera del turno de texto (avanzar días del escenario, descansar en
/// el campamento) pasa por `avanzarRelojConTick`, que corre el tick diario del Reino una vez por medianoche.
describe('avanzarRelojConTick (P216/P217)', () => {
  let saveId: string;
  let worldId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const save = await prisma.save.create({
      data: {
        userId, worldId, characterName: 'Reloj con tick', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'R',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 500 } });
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), poblacion: 2, comida: 400, bebida: 400 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const correr = (antes: number, despues: number) =>
    prisma.$transaction((tx) => avanzarRelojConTick(tx, { saveId, worldId, minutosAntes: antes, minutosDespues: despues }));
  const bebida = async () => (await prisma.kingdomStats.findFirstOrThrow({ where: { saveId } })).bebida;

  it('fija el reloj y corre el tick del Reino una vez por medianoche cruzada', async () => {
    const b0 = await bebida();
    await correr(500, 1440 + 480); // 1 medianoche
    const b1 = await bebida();
    expect(b1).toBeLessThan(b0);
    const ws = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect(ws.fictionalMinutes).toBe(1920);
    await correr(1920, 1920 + 1440); // 1 medianoche más: consumo de un día (el 1.º día se topa con el almacén)
    const b2 = await bebida();
    const unDia = b1 - b2;
    expect(unDia).toBeGreaterThan(0);
    await correr(3360, 3360 + 3 * 1440); // 3 medianoches de golpe
    expect(b2 - (await bebida())).toBe(unDia * 3);
  });

  it('sin cruzar medianoche no toca el Reino', async () => {
    const antes = await bebida();
    await correr(6240, 6300); // mismo día
    expect(await bebida()).toBe(antes);
  });
});
