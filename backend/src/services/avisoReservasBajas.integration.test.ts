import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { advanceKingdomStatsDay } from './dailyTick.js';
import { avisoDeReserva } from './kingdomTick.js';

/// P381 (2026-11-10): aviso en el canal del Reino cuando queda bebida o comida para menos de 7 días, una vez por racha.
describe('P381: aviso de reservas bajas', () => {
  it('avisoDeReserva: umbral, racha y consumo 0', () => {
    expect(avisoDeReserva(35, 5, false)).toMatchObject({ avisar: false, yaAvisado: false });
    expect(avisoDeReserva(34, 5, false)).toMatchObject({ avisar: true, dias: 6, yaAvisado: true });
    expect(avisoDeReserva(30, 5, true)).toMatchObject({ avisar: false, yaAvisado: true });
    expect(avisoDeReserva(0, 0, true)).toMatchObject({ avisar: false, yaAvisado: false });
  });

  const saves: string[] = [];
  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saves } } });
  });
  async function reino(nombre: string, k: { soldados: number; comida: number; bebida: number }): Promise<string> {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'P',
        worldState: { create: { fictionalMinutes: 10 * 1440 + 600 } },
      },
    });
    saves.push(save.id);
    await prisma.kingdomStats.create({ data: { saveId: save.id, ownerKey: `save:${save.id}`, ...k } });
    return save.id;
  }
  const dia = (saveId: string, n: number) => prisma.$transaction((tx) => advanceKingdomStatsDay(tx, saveId, 1, n * 1440 + 600));
  const avisos = async (saveId: string, que: string) =>
    (await prisma.logEntry.findMany({ where: { saveId, channel: 'KINGDOM', text: { contains: que } } })).map((l) => l.text);

  it('avisa al bajar de 7 días, no repite, se rearma tras reponer', async () => {
    // 5 bocas: 40 de bebida = 8 días; tras el día 11 quedan 35 (7 días justos, sin aviso).
    const saveId = await reino('Reservas (P381)', { soldados: 5, comida: 5000, bebida: 40 });
    await dia(saveId, 11);
    expect(await avisos(saveId, 'bebida')).toHaveLength(0);
    await dia(saveId, 12); // 30 → 6 días
    const primero = await avisos(saveId, 'bebida');
    expect(primero).toHaveLength(1);
    expect(primero[0]).toContain('6 días');
    await dia(saveId, 13); // 25 → 5 días: sigue la racha, sin repetir
    expect(await avisos(saveId, 'bebida')).toHaveLength(1);
    // Se repone: vuelve a 7 días o más y la racha se rearma.
    await prisma.kingdomStats.update({ where: { ownerKey: `save:${saveId}` }, data: { bebida: 60 } });
    await dia(saveId, 14); // 55
    expect(await avisos(saveId, 'bebida')).toHaveLength(1);
    await prisma.kingdomStats.update({ where: { ownerKey: `save:${saveId}` }, data: { bebida: 20 } });
    await dia(saveId, 15); // 15 → 3 días
    const tercero = await avisos(saveId, 'bebida');
    expect(tercero).toHaveLength(2);
    expect(tercero[1]).toContain('3 días');
    expect(await avisos(saveId, 'comida')).toHaveLength(0);
  });

  it('avisa también de la comida, y con consumo 0 no avisa de nada', async () => {
    const hambre = await reino('Comida (P381)', { soldados: 5, comida: 20, bebida: 5000 });
    await dia(hambre, 11);
    expect(await avisos(hambre, 'comida')).toHaveLength(1);
    await dia(hambre, 12);
    expect(await avisos(hambre, 'comida')).toHaveLength(1);

    const vacio = await reino('Vacío (P381)', { soldados: 0, comida: 3, bebida: 3 });
    await dia(vacio, 11);
    await dia(vacio, 12);
    expect(await prisma.logEntry.count({ where: { saveId: vacio, channel: 'KINGDOM' } })).toBe(0);
  });
});
