import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { aplicarEfecto } from './efectos.js';
import { evaluarConsecuencias } from './consecuencias.js';
import { procesarReacciones } from './reacciones.js';
import { registrarSuceso } from './sucesos.js';
import { testigosEnLugar } from './testigos.js';

// CR-11 (hito 0.2) — venganza: al matar, los NPC con nombre presentes son testigos; el de la facción
// de la víctima vuelve a los 5-15 días junto a la jugadora y, al cruzarse, la ataca (combate forzado).
describe('venganza (CR-11)', () => {
  const saveIds: string[] = [];
  const DIA = 1440;

  async function escena(nombre: string, faccionTestigo: 'mismo' | 'otro') {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const [victima, mismoClan] = await prisma.npc.findMany({ where: { worldId, kind: 'PRINCIPAL', faction: 'Clan Serhu', muertoEnMundo: false }, orderBy: { slug: 'asc' }, take: 2 });
    const otroClan = await prisma.npc.findFirstOrThrow({ where: { worldId, kind: 'PRINCIPAL', faction: 'Clan Helsig', muertoEnMundo: false }, orderBy: { slug: 'asc' } });
    const testigo = faccionTestigo === 'mismo' ? mismoClan! : otroClan;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'V',
        currentLocationId: hondonada.id, zonaPosX: 200, zonaPosY: 200,
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    await prisma.zonePoint.create({ data: { saveId: save.id, locationId: hondonada.id, tipo: 'NPC', targetSlug: testigo.slug, x: 400, y: 400 } });
    const testigos = await prisma.$transaction((tx) => testigosEnLugar(tx, save.id, worldId, hondonada.id, victima!.id));
    await prisma.$transaction((tx) => registrarSuceso(tx, {
      saveId: save.id, tipo: 'MUERTE_CAUSADA', fictionalMinutes: 480, locationId: hondonada.id, origen: 'JUGADOR',
      actores: [
        { entidadTipo: 'PERSONAJE', entidadId: save.id, papel: 'AUTOR' },
        { entidadTipo: 'NPC', entidadId: victima!.id, papel: 'VICTIMA' },
        ...testigos.map((id) => ({ entidadTipo: 'NPC' as const, entidadId: id, papel: 'TESTIGO' as const })),
      ],
      datos: { personaje: nombre, victima: victima!.name },
    }));
    await procesarReacciones(prisma, save.id);
    return { saveId: save.id, worldId, testigo, testigos };
  }

  const pendientes = async (saveId: string) => ((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).pendingCombatNpcSlugs as string[]) ?? [];

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('el testigo de su facción vuelve a los 5-15 días junto a la jugadora y, al cruzarse, la ataca', async () => {
    const { saveId, testigo, testigos } = await escena('Venganza (CR-11)', 'mismo');
    expect(testigos).toEqual([testigo.id]);
    expect(await prisma.logEntry.count({ where: { saveId, text: `${testigo.name} lo ha visto todo, y no lo va a olvidar.` } })).toBe(1);

    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 480 + 4 * DIA } });
    expect((await evaluarConsecuencias(prisma, saveId)).disparadas).toBe(0);
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 480 + 16 * DIA } });
    await evaluarConsecuencias(prisma, saveId); // aparece a una celda
    expect(await prisma.zonePoint.count({ where: { saveId, targetSlug: testigo.slug, x: 250, y: 200, activo: true } })).toBe(1);
    expect(await pendientes(saveId)).not.toContain(testigo.slug);

    await evaluarConsecuencias(prisma, saveId); // se cruzan
    expect(await pendientes(saveId)).toContain(testigo.slug);
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: `${testigo.name} te ha encontrado` } } })).toBe(1);
  });

  it('un testigo de otra facción no se venga', async () => {
    const { saveId } = await escena('Venganza (CR-11) otra facción', 'otro');
    expect(await prisma.consecuencia.count({ where: { saveId, regla: 'VENGANZA_PARIENTE' } })).toBe(0);
  });

  it('si el vengador muere antes, la venganza se pierde', async () => {
    const { saveId, worldId, testigo } = await escena('Venganza (CR-11) vengador muerto', 'mismo');
    await prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: 480 + DIA, origen: 'MOTOR' }, { tipo: 'matarNpc', npcId: testigo.id }));
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 480 + 16 * DIA } });
    await evaluarConsecuencias(prisma, saveId);
    expect((await prisma.consecuencia.findFirstOrThrow({ where: { saveId, regla: 'VENGANZA_PARIENTE' } })).estado).toBe('DISPARADA');
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'CONSECUENCIA_PERDIDA' } })).toBe(1);
    expect(await pendientes(saveId)).not.toContain(testigo.slug);
  });
});
