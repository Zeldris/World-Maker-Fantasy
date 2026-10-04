import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { aplicarEfecto } from './efectos.js';
import { envejecerDia } from './envejecer.js';
import { candidatosALider } from './reglasConsecuencias.js';
import { atributosPorEdad, edadProvisional, MINUTOS_POR_ANIO } from './edades.js';

// CR-13 paso 13b (hito 0.2) contra Postgres real: los nacidos en la partida crecen y envejecen con
// sus atributos, un niño no puede liderar, y los mayores mueren de viejo.
describe('envejecer (CR-13)', () => {
  const saveIds: string[] = [];
  let worldId: string;
  const AHORA = 480 + 20 * 1440;

  async function partida(nombre: string) {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'E',
        worldState: { create: { fictionalMinutes: AHORA } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return save.id;
  }
  const nacer = async (saveId: string) => {
    const r = await prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: AHORA, origen: 'MUNDO', random: () => 0.3 }, { tipo: 'crearNpc', faccionSlug: 'clan-goshg' }));
    return prisma.npc.findUniqueOrThrow({ where: { id: r.id! } });
  };

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
  });
  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('quien destaca es un adulto joven: con sus atributos de adulto y fecha de nacimiento', async () => {
    const saveId = await partida('Envejecer (CR-13) adulto');
    const npc = await nacer(saveId);
    const edad = Math.floor((AHORA - npc.nacidoEn!) / MINUTOS_POR_ANIO);
    expect(edad).toBeGreaterThanOrEqual(10);
    expect(edad).toBeLessThanOrEqual(15);
    expect(npc.attributes).toEqual(npc.atributosPotenciales);
  });

  it('un niño tiene los atributos de su edad, no puede liderar, y crece; en la vejez los pierde', async () => {
    const saveId = await partida('Envejecer (CR-13) niño');
    const npc = await nacer(saveId);
    const potenciales = npc.atributosPotenciales as Record<string, number>;
    // Ahora tiene 5 años.
    await prisma.npc.update({ where: { id: npc.id }, data: { nacidoEn: AHORA - 5 * MINUTOS_POR_ANIO } });
    expect((await envejecerDia(prisma, saveId, 20, () => 0.99)).ajustados).toBe(1);
    expect((await prisma.npc.findUniqueOrThrow({ where: { id: npc.id } })).attributes).toEqual(atributosPorEdad(potenciales, 'orcos', 5));
    const goshg = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'clan-goshg' } });
    expect((await prisma.$transaction((tx) => candidatosALider(tx, saveId, worldId, goshg))).map((n) => n.id)).not.toContain(npc.id);

    // 51 años: vejez (desde los 48), −3 en fuerza, destreza y constitución.
    await prisma.npc.update({ where: { id: npc.id }, data: { nacidoEn: AHORA - 51 * MINUTOS_POR_ANIO } });
    await envejecerDia(prisma, saveId, 20, () => 0.99);
    const viejo = (await prisma.npc.findUniqueOrThrow({ where: { id: npc.id } })).attributes as Record<string, number>;
    expect(viejo.fuerza).toBe(potenciales.fuerza! - 3);
    expect(viejo.voluntad).toBe(potenciales.voluntad);
  });

  it('los mayores mueren de viejo (también los del catálogo, solo en esa partida)', async () => {
    const saveId = await partida('Envejecer (CR-13) muerte');
    const otra = await partida('Envejecer (CR-13) otra');
    const dulgren = await prisma.npc.findFirstOrThrow({ where: { worldId, name: 'Dulgren', saveId: null } });
    // Lo bastante lejos para que Dulgren sea muy viejo (esperanza orca 60).
    const anos = 70 - edadProvisional(dulgren.slug, 'orcos', false);
    const futuro = AHORA + anos * MINUTOS_POR_ANIO;
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: futuro } });
    const { muertos } = await envejecerDia(prisma, saveId, Math.floor(futuro / 1440), () => 0);
    expect(muertos).toContain(dulgren.id);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'MUERTE_NPC', texto: 'Muere Dulgren (de viejo).' } })).toBe(1);
    // En la otra partida sigue vivo.
    expect(await prisma.npcState.count({ where: { saveId: otra, npcId: dulgren.id, muerto: true } })).toBe(0);
  });
});
