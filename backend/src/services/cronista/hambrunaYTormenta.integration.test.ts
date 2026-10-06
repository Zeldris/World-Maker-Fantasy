import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { slugify } from '../../lib/slugify.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { producirFacciones } from '../factionEconomy.js';
import { advanceKingdomStatsDay } from '../dailyTick.js';
import { stripRegionArticle } from '../population.js';
import { procesarReacciones, COHESION_HAMBRUNA } from './reacciones.js';
import { registrarHambruna } from './hambruna.js';
import { registrarSuceso } from './sucesos.js';
import { REGIONES_VECINAS } from './regiones.js';

// CR-12 paso 12c (hito 0.2, roadmap-cronista.md § 7.1) contra Postgres real: la fauna huye de una
// tormenta extrema a una región vecina, y una facción con 3 días seguidos de hambre registra
// HAMBRUNA, pierde cohesión y puede rebelarse.
describe('fauna que huye y hambruna (CR-12)', () => {
  const saveIds: string[] = [];
  let worldId: string;

  async function partida(nombre: string) {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'H',
        worldState: { create: { fictionalMinutes: 480 + 5 * 1440 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return save.id;
  }

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('una tormenta extrema hace huir fauna de su región a una vecina', async () => {
    const saveId = await partida('Tormenta (CR-12)');
    const fauna = await prisma.worldPopulation.findMany({ where: { saveId, targetType: { not: 'RAZA' }, poblacion: { gt: 0 } } });
    const peso = (f: (typeof fauna)[number], r: string) => (f.distribucion as Record<string, number>)[stripRegionArticle(r)] ?? 0;
    const region = Object.keys(REGIONES_VECINAS).find((r) => fauna.some((f) => peso(f, r) > 0))!;
    await prisma.$transaction((tx) => registrarSuceso(tx, {
      saveId, tipo: 'TORMENTA_EXTREMA', fictionalMinutes: 480 + 5 * 1440, origen: 'MUNDO', regionSlug: slugify(region),
      actores: [{ entidadTipo: 'REGION', entidadId: slugify(region), papel: 'LUGAR' }], datos: { region },
    }));
    await procesarReacciones(prisma, saveId, () => 0);

    const migraciones = await prisma.suceso.findMany({ where: { saveId, tipo: 'MIGRACION_FAUNA' } });
    expect(migraciones.length).toBeGreaterThan(0);
    for (const m of migraciones) {
      const d = m.datos as { desde: string; hacia: string };
      expect(d.desde).toBe(region);
      expect(REGIONES_VECINAS[region]).toContain(d.hacia);
    }
  });

  it('3 días seguidos sin comida: HAMBRUNA en el Libro, cohesión −10 y, con mala suerte, rebelión', async () => {
    const saveId = await partida('Hambruna (CR-12)');
    const f = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: { not: null } }, orderBy: { slug: 'asc' }, include: { kingdomStats: true } });
    // Mucha gente, nada de comida, ni edificios que produzcan.
    await prisma.building.updateMany({ where: { factionId: f.id }, data: { status: 'DANADO' } });
    await prisma.kingdomStats.update({ where: { id: f.kingdomStats!.id }, data: { poblacion: 100, trabajadores: 0, comida: 0, diasHambre: 0, ultimoDiaProducido: 5 } });
    await prisma.faction.update({ where: { id: f.id }, data: { cohesion: 70 } });
    const resultado = { diasProcesados: 0, semanasDecaidas: 0, depositados: 0 };

    // Con la hambruna de facciones encendida (apagada por defecto hasta tener los números de su economía).
    await producirFacciones(prisma, worldId, { id: f.id }, 7, resultado, { hambruna: true });
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'HAMBRUNA' } })).toBe(0);
    await producirFacciones(prisma, worldId, { id: f.id }, 8, resultado, { hambruna: true });
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { id: f.kingdomStats!.id } })).diasHambre).toBe(3);
    const hambruna = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'HAMBRUNA' } });
    expect(hambruna.texto).toBe(`El hambre llega a ${f.name}.`);

    await procesarReacciones(prisma, saveId, () => 0);
    expect((await prisma.faction.findUniqueOrThrow({ where: { id: f.id } })).cohesion).toBe(70 + COHESION_HAMBRUNA);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'REBELION' } })).toBe(1);
  });

  it('con la hambruna de facciones apagada se lleva la cuenta pero no se registra (CR-54 la enciende por defecto)', async () => {
    const saveId = await partida('Hambruna (CR-12) apagada');
    const f = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: { not: null } }, orderBy: { slug: 'asc' }, include: { kingdomStats: true } });
    await prisma.building.updateMany({ where: { factionId: f.id }, data: { status: 'DANADO' } });
    await prisma.kingdomStats.update({ where: { id: f.kingdomStats!.id }, data: { poblacion: 100, trabajadores: 0, comida: 0, diasHambre: 0, ultimoDiaProducido: 5 } });
    await producirFacciones(prisma, worldId, { id: f.id }, 9, { diasProcesados: 0, semanasDecaidas: 0, depositados: 0 }, { hambruna: false });
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { id: f.kingdomStats!.id } })).diasHambre).toBe(4);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'HAMBRUNA' } })).toBe(0);
  });

  it('con buena suerte la hambruna no acaba en rebelión; el Reino de la jugadora también puede pasar hambre', async () => {
    const saveId = await partida('Hambruna (CR-12) reino');
    const reino = await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-hambriento', name: 'Reino Hambriento', raza: 'humano', description: 'x' } });
    await prisma.$transaction((tx) => registrarHambruna(tx, saveId, 'REINO_JUGADORA'));
    await procesarReacciones(prisma, saveId, () => 0.99);
    expect((await prisma.faction.findUniqueOrThrow({ where: { id: reino.id } })).cohesion).toBe(70 + COHESION_HAMBRUNA);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'HAMBRUNA' } })).toBe(1);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'REBELION' } })).toBe(0);
  });

  it('el Reino de la jugadora sin comida 3 días: HAMBRUNA desde el tick diario de su reino', async () => {
    const saveId = await partida('Hambruna (CR-12) tick del reino');
    await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-sin-pan', name: 'Reino sin Pan', raza: 'humano', description: 'x' } });
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: `save:${saveId}`, poblacion: 10, comida: 0, bebida: 100 } });
    await prisma.$transaction((tx) => advanceKingdomStatsDay(tx, saveId, 2));
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'HAMBRUNA' } })).toBe(0);
    await prisma.$transaction((tx) => advanceKingdomStatsDay(tx, saveId, 1));
    expect((await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'HAMBRUNA' } })).texto).toBe('El hambre llega a Reino sin Pan.');
  });
});
