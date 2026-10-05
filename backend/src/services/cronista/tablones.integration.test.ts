import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { tickFactionProduction } from '../kingdomTick.js';
import { CONSTRUCTION_RECIPES } from '../construction.js';
import { asegurarTablonesDePartida, avisosDeTablon, tablonEnLugar, tablonesDePartida, TABLON_RECIPE_KEY } from './tablones.js';

/// CR-40 40c contra Postgres real: las ciudades con interior tienen su tablón de avisos, la partida
/// nueva lo recibe al clonar el mundo y la antigua, de forma perezosa; el tablón no produce nada y el
/// Reino lo puede construir.
describe('tablones de avisos (CR-40 40c)', () => {
  let saveId: string;

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Tablones', characterArchetype: 'guerrero', raza: 'nabieus', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'T',
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('la partida nueva tiene un tablón en cada ciudad con interior', async () => {
    const tablones = await prisma.$transaction((tx) => tablonesDePartida(tx, saveId));
    expect(tablones.map((t) => t.faction!.slug).sort()).toEqual(['clan-goshg', 'clan-helsig', 'clan-serhu', 'feg-ger', 'feg-tusha', 'keseg-prisilke']);
    expect(tablones.every((t) => t.location?.name)).toBe(true);
  });

  it('una partida clonada antes de que existiera lo recibe una sola vez', async () => {
    await prisma.building.deleteMany({ where: { recipeKey: TABLON_RECIPE_KEY, faction: { saveId } } });
    expect(await prisma.$transaction((tx) => asegurarTablonesDePartida(tx, saveId))).toBe(6);
    expect(await prisma.$transaction((tx) => asegurarTablonesDePartida(tx, saveId))).toBe(0);
    expect(await prisma.building.count({ where: { recipeKey: TABLON_RECIPE_KEY, faction: { saveId } } })).toBe(6);
  });

  it('no produce nada y el Reino lo puede construir', () => {
    expect(tickFactionProduction([{ recipeKey: TABLON_RECIPE_KEY, status: 'ACTIVO' }])).toEqual({ comida: 0, riqueza: 0 });
    const receta = CONSTRUCTION_RECIPES.find((r) => r.nounRegex.test('construir un tablon de avisos'));
    expect(receta?.key).toBe(TABLON_RECIPE_KEY);
    expect(receta?.requiresAyuntamiento).toBe(true);
  });

  it('lista los avisos de su tablón; el del Reino, solo los de las facciones con tratado o alianza (40g)', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const serhu = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' } });
    const helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-helsig' } });
    const tablonSerhu = await prisma.building.findFirstOrThrow({ where: { factionId: serhu.id, recipeKey: TABLON_RECIPE_KEY } });
    const tablonHelsig = await prisma.building.findFirstOrThrow({ where: { factionId: helsig.id, recipeKey: TABLON_RECIPE_KEY } });
    const aviso = (buildingId: string, factionId: string, titulo: string) => prisma.misionOfrecida.create({
      data: { saveId, buildingId, factionId, tipo: 'EXPLORAR', motivo: 'RUMOR', huecos: {}, titulo, descripcion: 'x', recompensa: { xp: 40 }, creadaEn: 0, retiraEn: 99_999 },
    });
    await aviso(tablonSerhu.id, serhu.id, 'De Serhu');
    await aviso(tablonHelsig.id, helsig.id, 'De Helsig');

    expect(await tablonEnLugar(prisma, saveId, tablonSerhu.locationId!)).toMatchObject({ buildingId: tablonSerhu.id, nombre: 'Poste de cacería', faccion: 'Clan Serhu' });
    expect((await avisosDeTablon(prisma, saveId, tablonSerhu.id))!.avisos.map((a) => a.titulo)).toEqual(['De Serhu']);

    // Tablón del Reino: con tratado con Serhu (y nada con Helsig) solo ve el aviso de Serhu.
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const reino = await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-tablones', name: 'Reino de los Tablones', raza: 'orcos', description: 'x' } });
    const delReino = await prisma.building.create({ data: { saveId, locationId: lugar.id, recipeKey: TABLON_RECIPE_KEY, name: 'un tablón de avisos', kind: 'tablon', status: 'ACTIVO', description: 'x' } });
    await prisma.factionRelation.create({ data: { worldId, saveId, sourceFactionId: reino.id, targetFactionId: serhu.id, presion: 35, type: 'TRATADO_COMERCIAL' } });
    expect(await tablonEnLugar(prisma, saveId, lugar.id)).toMatchObject({ buildingId: delReino.id, nombre: 'Muro de los susurros', faccion: null });
    expect((await avisosDeTablon(prisma, saveId, delReino.id))!.avisos.map((a) => a.titulo)).toEqual(['De Serhu']);
    expect(await avisosDeTablon(prisma, saveId, 'no-existe')).toBeNull();
  });
});
