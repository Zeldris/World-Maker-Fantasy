import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { buildNpcInScene } from '../npcScene.js';
import { npcAttributesForLevel } from '../progression.js';
import { aplicarEfecto } from './efectos.js';
import { envejecerDia } from './envejecer.js';
import { atributosPorEdad, edadProvisional, MINUTOS_POR_ANIO } from './edades.js';
import { narrarDia, SUCESOS_DE_FONDO, TOPE_PRESUPUESTO } from './narradorFondo.js';

// CR-13 paso 13c (hito 0.2) contra Postgres real: una pareja con nombre tiene un hijo que nace con
// los atributos de su edad y la herencia de sus padres; sin pareja no nace nadie; la vejez de los
// NPC del catálogo va por partida y se nota en sus atributos de escena.
describe('nacimientos y vejez del catálogo (CR-13)', () => {
  const saveIds: string[] = [];
  let worldId: string;
  const AHORA = 480 + 20 * 1440;

  async function partida(nombre: string) {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'N',
        worldState: { create: { fictionalMinutes: AHORA, presupuestoTension: TOPE_PRESUPUESTO } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return save.id;
  }
  const nacer = (saveId: string, faccionSlug: string) =>
    prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: AHORA, origen: 'MUNDO', random: () => 0.3 }, { tipo: 'crearNpc', faccionSlug, como: 'NACE' }));

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
  });
  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('nace un bebé de Dulgren y Doshka: 0 años, atributos de su edad, en el Libro', async () => {
    const saveId = await partida('Nacimiento (CR-13)');
    const r = await nacer(saveId, 'clan-goshg');
    expect(r.aplicado).toBe(true);
    const bebe = await prisma.npc.findUniqueOrThrow({ where: { id: r.id! } });
    expect(bebe.nacidoEn).toBe(AHORA);
    expect(bebe.attributes).toEqual(atributosPorEdad(bebe.atributosPotenciales as Record<string, number>, 'orcos', 0));
    expect(bebe.role).toMatch(/^Niñ[oa] de Clan Goshg$/);
    const suceso = await prisma.suceso.findUniqueOrThrow({ where: { id: r.sucesoId! } });
    expect(suceso.tipo).toBe('NACIMIENTO_NOTABLE');
    expect(suceso.texto).toBe(`Nace ${bebe.name}, ${bebe.genero === 'F' ? 'hija' : 'hijo'} de Dulgren y Doshka.`);
  });

  it('sin pareja con nombre en la facción (Los del Obelisco) no nace nadie; el narrador lo trae donde la hay', async () => {
    const saveId = await partida('Nacimiento (CR-13) sin pareja');
    expect((await nacer(saveId, 'los-del-obelisco')).aplicado).toBe(false);
    const nacimiento = SUCESOS_DE_FONDO.find((s) => s.tipo === 'NACIMIENTO_NOTABLE')!;
    const res = await narrarDia(prisma, saveId, 20, () => 0.01, [nacimiento]);
    expect(res.tipo).toBe('NACIMIENTO_NOTABLE');
  });

  it('la vejez de un NPC del catálogo va por partida y resta en sus atributos de escena', async () => {
    const saveId = await partida('Vejez del catálogo (CR-13)');
    const dulgren = await prisma.npc.findFirstOrThrow({ where: { worldId, name: 'Dulgren', saveId: null }, include: { items: { include: { item: true } } } });
    // 51 años en esta partida: 3 de vejez (orcos, desde los 48).
    const futuro = AHORA + (51 - edadProvisional(dulgren.slug, 'orcos', false)) * MINUTOS_POR_ANIO;
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: futuro } });
    await envejecerDia(prisma, saveId, Math.floor(futuro / 1440), () => 0.99);
    const estado = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: dulgren.id, scope: '' } });
    expect(estado.vejez).toBe(3);
    const base = npcAttributesForLevel(dulgren.attributes as never, dulgren.level, dulgren.clase);
    const enEscena = buildNpcInScene(dulgren, estado).attributes;
    expect(enEscena.fuerza).toBe(base.fuerza - 3);
    expect(enEscena.voluntad).toBe(base.voluntad);
    // El catálogo no cambia.
    expect((await prisma.npc.findUniqueOrThrow({ where: { id: dulgren.id } })).attributes).toEqual(dulgren.attributes);
  });
});
