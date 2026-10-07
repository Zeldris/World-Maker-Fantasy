import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { pelearEscaramuza, resumenEscaramuza } from './escaramuzas.js';
import { syncFactionPopulationToKingdomStats } from '../population.js';

/// CR-62 (62c): una escaramuza se pelea de verdad y sus muertos restan soldados.
function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

describe('escaramuzas de fondo (CR-62 62c)', () => {
  let saveId: string;
  let worldId: string;
  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'x', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'X',
        worldState: { create: { fictionalMinutes: 0 } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    // Los soldados de cada facción salen de sus filas de población (como cada día en la partida).
    await syncFactionPopulationToKingdomStats(prisma, { saveId });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const soldados = async (slug: string) => (await prisma.faction.findFirstOrThrow({ where: { saveId, slug }, include: { kingdomStats: true } })).kingdomStats!.soldados;

  it('Serhu contra Feg Ger: hay un resultado y los muertos de cada bando restan sus soldados', async () => {
    const antesA = await soldados('clan-serhu');
    const antesB = await soldados('feg-ger');
    // Con la muerte al 100 % para que el test vea bajas (en juego, el 3 % de los caídos).
    const r = await prisma.$transaction((tx) => pelearEscaramuza(tx, { saveId, worldId }, 'clan-serhu', 'feg-ger', 8, 8, semilla(1), 1));
    expect(r).not.toBeNull();
    expect(r!.nombreA).toBe('Clan Serhu');
    const muertosA = antesA - (await soldados('clan-serhu'));
    const muertosB = antesB - (await soldados('feg-ger'));
    expect(muertosA + muertosB).toBeGreaterThan(0);
    expect(muertosA).toBe(r!.muertosA);
    expect(muertosB).toBe(r!.muertosB);
    expect(resumenEscaramuza(r!)).toMatch(/caen/);
  });

  it('contra los renegados (sin facción rival)', async () => {
    const r = await prisma.$transaction((tx) => pelearEscaramuza(tx, { saveId, worldId }, 'clan-serhu', null, 20, 5, semilla(3)));
    expect(r?.nombreB).toBe('los renegados');
  });

  it('el resumen cuenta quién se retira o se queda con el campo y los muertos', () => {
    const base = { nombreA: 'Clan Serhu', nombreB: 'Feg Ger', muertosA: 0, muertosB: 0 };
    expect(resumenEscaramuza({ ...base, ganador: 'A', retiradas: ['B'], muertosB: 2 })).toBe('Feg Ger se retira; caen 2 de Feg Ger');
    expect(resumenEscaramuza({ ...base, ganador: 'B', retiradas: [] })).toBe('Feg Ger se queda con el campo');
  });
});
