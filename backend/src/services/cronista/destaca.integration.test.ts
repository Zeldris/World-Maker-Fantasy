import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida, npcDeLaPartida, npcVivoEnPartida } from '../mundoPartida.js';
import { aplicarEfecto } from './efectos.js';
import { narrarDia, SUCESOS_DE_FONDO, TOPE_PRESUPUESTO } from './narradorFondo.js';

// CR-13 paso 13a (hito 0.2) contra Postgres real: «alguien que destaca» hereda de un padre y una
// madre con nombre de su facción, tiene un nombre nuevo del generador, existe solo en su partida y
// lo trae el narrador de fondo.
describe('alguien que destaca (CR-13)', () => {
  const saveIds: string[] = [];
  let worldId: string;

  async function partida(nombre: string) {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'D',
        worldState: { create: { fictionalMinutes: 480 + 20 * 1440, presupuestoTension: TOPE_PRESUPUESTO } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return save.id;
  }
  const crear = (saveId: string, faccionSlug: string, random: () => number) =>
    prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: 480 + 20 * 1440, origen: 'MUNDO', random }, { tipo: 'crearNpc', faccionSlug }));

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
  });
  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('del Clan Goshg: hijo o hija de Dulgren y Doshka, con su huella, nombre nuevo y solo en esta partida', async () => {
    const saveId = await partida('Destaca (CR-13)');
    const otra = await partida('Destaca (CR-13) otra partida');
    const r = await crear(saveId, 'clan-goshg', () => 0.3);
    expect(r.aplicado).toBe(true);
    const npc = await prisma.npc.findUniqueOrThrow({ where: { id: r.id! } });
    const [dulgren, doshka] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, name: 'Dulgren', saveId: null } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, name: 'Doshka', saveId: null } }),
    ]);
    expect(npc).toMatchObject({ saveId, kind: 'PRINCIPAL', faction: 'Clan Goshg', raza: 'orcos', padreNpcId: dulgren.id, madreNpcId: doshka.id });
    expect(npc.slug.endsWith(saveId.slice(-6))).toBe(true);
    const a = npc.attributes as Record<string, number>;
    const p = dulgren.attributes as Record<string, number>;
    const m = doshka.attributes as Record<string, number>;
    for (const k of Object.keys(p)) if (k !== 'magia') expect(a[k]).toBeGreaterThanOrEqual(Math.round((p[k]! + m[k]!) / 2) - 2);

    const suceso = await prisma.suceso.findUniqueOrThrow({ where: { id: r.sucesoId! } });
    expect(suceso.texto).toBe(`${npc.name} empieza a hacerse un nombre en Clan Goshg, ${npc.genero === 'F' ? 'hija' : 'hijo'} de Dulgren y Doshka.`);

    // Existe en su partida; en otra no (ni en escena ni en la Enciclopedia).
    expect(await prisma.npc.count({ where: { id: npc.id, ...npcVivoEnPartida(saveId) } })).toBe(1);
    expect(await prisma.npc.count({ where: { id: npc.id, ...npcVivoEnPartida(otra) } })).toBe(0);
    expect(await prisma.npc.count({ where: { id: npc.id, ...npcDeLaPartida(otra) } })).toBe(0);
    // Y el filtro sigue dejando pasar a los del catálogo.
    expect(await prisma.npc.count({ where: { id: dulgren.id, ...npcVivoEnPartida(otra) } })).toBe(1);
  });

  it('sin pareja en su facción: de padres desconocidos, con los atributos de alguien de su raza', async () => {
    const saveId = await partida('Destaca (CR-13) sin padres');
    const r = await crear(saveId, 'los-del-obelisco', () => 0.5);
    expect(r.aplicado).toBe(true);
    const npc = await prisma.npc.findUniqueOrThrow({ where: { id: r.id! } });
    expect(npc).toMatchObject({ faction: 'Los del Obelisco', raza: 'goirntes', padreNpcId: null, madreNpcId: null });
    expect(npc.name.split(' ')).toHaveLength(2); // nombre y apellido goirnte
  });

  it('el narrador de fondo lo trae, y los nombres no se repiten', async () => {
    const saveId = await partida('Destaca (CR-13) narrador');
    const destaca = SUCESOS_DE_FONDO.find((s) => s.tipo === 'NPC_DESTACA')!;
    const r = await narrarDia(prisma, saveId, 20, () => 0.1, [destaca]);
    expect(r.tipo).toBe('NPC_DESTACA');
    for (let i = 0; i < 5; i++) await crear(saveId, 'clan-goshg', () => 0.3);
    const nacidos = await prisma.npc.findMany({ where: { saveId } });
    expect(nacidos).toHaveLength(6);
    expect(new Set(nacidos.map((n) => n.name)).size).toBe(6);
  });
});
