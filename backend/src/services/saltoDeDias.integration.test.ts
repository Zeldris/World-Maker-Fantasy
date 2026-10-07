import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { advanceKingdomStatsDay } from './dailyTick.js';
import { tickKingdom, SIN_SUMINISTROS, DEFAULT_KINGDOM_STATS } from './kingdomTick.js';
import { porcionDelDia } from './cronista/comidaOficios.js';

/// QA-19 (retros del 2026-10-07): avanzar N días de golpe da lo mismo que avanzar N veces un día. El
/// salto de varios días falló en la Fase E del 0.2, en la A y la D del 0.3 y en el PR #29.
describe('QA-19: N días de golpe = N veces un día', () => {
  it('las medias de comida se reparten por número de día, sin restos guardados', () => {
    expect([1, 2, 3, 4].map((d) => porcionDelDia(2.5, d))).toEqual([2, 3, 2, 3]);
    expect([1, 2, 3].map((d) => porcionDelDia(3, d))).toEqual([3, 3, 3]);
    // 6/11 × 27,5 = 14,999999… en coma flotante: tiene que contar 15.
    expect(porcionDelDia((6 / 11) * 27.5, 1)).toBe(15);
    // Un rebaño que pierde media al día: -1, 0, -1, 0…
    expect([1, 2, 3, 4].map((d) => porcionDelDia(-0.5, d))).toEqual([-1, 0, -1, 0]);
  });

  it('tickKingdom: un salto de N días desde el día d = N ticks de un día', () => {
    const base = { ...DEFAULT_KINGDOM_STATS, poblacion: 6, comida: 20, bebida: 40, trabajadores: 4 };
    const s = { ...SIN_SUMINISTROS, agua: 7, comidaDia: 5.5 };
    for (const [d0, n] of [[1, 5], [37, 9], [118, 4]] as const) {
      let unoAUno = base;
      for (let i = 0; i < n; i++) unoAUno = tickKingdom(unoAUno, 1, d0 + i, s);
      expect(tickKingdom(base, n, d0, s)).toEqual(unoAUno);
    }
  });

  describe('el Reino en la base, cruzando un cambio de estación', () => {
    const saves: string[] = [];
    afterAll(async () => {
      await prisma.save.deleteMany({ where: { id: { in: saves } } });
    });
    // Del día 58 al 62: cruza de verano (2,5 por recolector) a otoño (2) en el día 60, así que cada día
    // tiene que usar su propia estación.
    const DESDE = 58;
    const DIAS = 4;
    async function reino(nombre: string): Promise<string> {
      const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
      const save = await prisma.save.create({
        data: {
          userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
          attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
          worldState: { create: { fictionalMinutes: DESDE * 1440 + 600 } },
        },
      });
      saves.push(save.id);
      await prisma.kingdomStats.create({ data: { saveId: save.id, ownerKey: `save:${save.id}`, poblacion: 5, trabajadores: 3, comida: 30, bebida: 50 } });
      for (const name of ['Urga', 'Brakka', 'Doru']) await prisma.subject.create({ data: { saveId: save.id, name, role: 'trabajador', notes: '' } });
      return save.id;
    }
    const stats = (saveId: string) => prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `save:${saveId}` }, select: { comida: true, bebida: true, riqueza: true, felicidad: true, diasHambre: true, diasSed: true } });

    it('advanceKingdomStatsDay de 4 días = 4 llamadas de 1 día', async () => {
      const deGolpe = await reino('Salto de golpe (QA-19)');
      await prisma.worldState.update({ where: { saveId: deGolpe }, data: { fictionalMinutes: (DESDE + DIAS) * 1440 + 600 } });
      await prisma.$transaction((tx) => advanceKingdomStatsDay(tx, deGolpe, DIAS));

      const diaADia = await reino('Salto día a día (QA-19)');
      for (let i = 1; i <= DIAS; i++) {
        await prisma.worldState.update({ where: { saveId: diaADia }, data: { fictionalMinutes: (DESDE + i) * 1440 + 600 } });
        await prisma.$transaction((tx) => advanceKingdomStatsDay(tx, diaADia, 1));
      }
      expect(await stats(deGolpe)).toEqual(await stats(diaADia));
    });
  });
});
