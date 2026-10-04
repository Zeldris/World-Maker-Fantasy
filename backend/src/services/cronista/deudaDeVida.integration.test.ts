import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { evaluarConsecuencias } from './consecuencias.js';
import { procesarReacciones } from './reacciones.js';
import { registrarSuceso } from './sucesos.js';

// CR-11 (hito 0.2) — deuda de vida de punta a punta: perdón → aviso → al llegar a OTRA región tras
// 3+ días, el perdonado aparece junto a la jugadora → al cruzarse, regalo y se va. Si no se cruzan,
// se va igual a los 2 días.
describe('deuda de vida (CR-11)', () => {
  const saveIds: string[] = [];
  const DIA = 1440;

  async function perdonar(nombre: string) {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const otra = await prisma.location.findFirstOrThrow({ where: { worldId, region: { not: hondonada.region } } });
    const perdonado = await prisma.npc.findFirstOrThrow({ where: { worldId, kind: 'PRINCIPAL', muertoEnMundo: false, temperamento: { not: 'ENEMIGO' } }, orderBy: { slug: 'asc' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'D',
        currentLocationId: hondonada.id, zonaPosX: 200, zonaPosY: 200, goirnos: 0,
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    await prisma.$transaction((tx) => registrarSuceso(tx, {
      saveId: save.id, tipo: 'PERDON_CONCEDIDO', fictionalMinutes: 480, locationId: hondonada.id, origen: 'JUGADOR',
      actores: [{ entidadTipo: 'PERSONAJE', entidadId: save.id, papel: 'AUTOR' }, { entidadTipo: 'NPC', entidadId: perdonado.id, papel: 'BENEFICIARIO' }],
      datos: { personaje: nombre, perdonado: perdonado.name },
    }));
    await procesarReacciones(prisma, save.id);
    return { saveId: save.id, hondonada, otra, perdonado };
  }

  const irA = (saveId: string, minutos: number, locationId: string, x: number, y: number) =>
    prisma.save.update({ where: { id: saveId }, data: { currentLocationId: locationId, zonaPosX: x, zonaPosY: y, worldState: { update: { fictionalMinutes: minutos } } } });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('perdón → aviso; en su región o antes de 3 días no pasa nada; en otra región aparece y al cruzarse regala', async () => {
    const { saveId, hondonada, otra, perdonado } = await perdonar('Deuda de vida (CR-11)');
    expect(await prisma.logEntry.count({ where: { saveId, text: `Algo te dice que volverás a ver a ${perdonado.name}.` } })).toBe(1);

    await irA(saveId, 480 + 5 * DIA, hondonada.id, 200, 200);
    expect((await evaluarConsecuencias(prisma, saveId)).disparadas).toBe(0);
    await irA(saveId, 480 + 2 * DIA, otra.id, 600, 500);
    expect((await evaluarConsecuencias(prisma, saveId)).disparadas).toBe(0);

    // Lejos de donde aparecerá: primero aparece, sin regalo todavía.
    await irA(saveId, 480 + 4 * DIA, otra.id, 600, 500);
    await evaluarConsecuencias(prisma, saveId);
    const punto = await prisma.zonePoint.findFirstOrThrow({ where: { saveId, targetSlug: perdonado.slug, locationId: otra.id } });
    expect(punto).toMatchObject({ activo: true, tipo: 'NPC', x: 650, y: 500 });
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'REGALO' } })).toBe(0);

    // Se cruzan (a una celda): regalo, entrada en el canal del personaje y el punto se va.
    await evaluarConsecuencias(prisma, saveId);
    const regalo = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'REGALO' } });
    expect(regalo.texto).toContain(perdonado.name);
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'No olvido que me dejaste vivir' } } })).toBe(1);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, include: { inventoryItems: true } });
    expect(save.goirnos > 0 || save.inventoryItems.some((i) => i.origin === `regalo de ${perdonado.name}`)).toBe(true);
    expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } })).activo).toBe(false);
  });

  it('si no llegan a cruzarse, a los 2 días se va sin regalo', async () => {
    const { saveId, otra, perdonado } = await perdonar('Deuda de vida (CR-11) sin cruce');
    await irA(saveId, 480 + 4 * DIA, otra.id, 100, 100);
    await evaluarConsecuencias(prisma, saveId);
    // Se aleja de donde apareció (a 1 celda de (100,100)).
    await irA(saveId, 480 + 4 * DIA, otra.id, 700, 550);
    await evaluarConsecuencias(prisma, saveId);
    await irA(saveId, 480 + 7 * DIA, otra.id, 700, 550);
    await evaluarConsecuencias(prisma, saveId);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'REGALO' } })).toBe(0);
    expect(await prisma.zonePoint.count({ where: { saveId, targetSlug: perdonado.slug, activo: true } })).toBe(0);
  });
});
