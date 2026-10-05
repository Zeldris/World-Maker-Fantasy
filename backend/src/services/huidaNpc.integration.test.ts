import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { buildNpcInScene, type NpcInScene } from './npcScene.js';
import { aplicarHuidaNpc, decidirMoralTrasIntercambio } from './huidaNpc.js';

/// `random` que da exactamente esos d20, en orden.
const d20 = (...valores: number[]) => {
  let i = 0;
  return () => (valores[i++ % valores.length]! - 1) / 20;
};

describe('CR-44 (44b) — moral del NPC en el combate 1v1', () => {
  let saveId: string;
  let worldId: string;
  let guerrero: NpcInScene;
  let fauna: NpcInScene;
  let lugarId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    lugarId = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (moral)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 12, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 }, portraitInitial: 'G',
        currentLocationId: lugarId, worldState: { create: { fictionalMinutes: 600 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'guerrero-serhu', saveId: null }, include: { items: { include: { item: true } } } });
    guerrero = { ...buildNpcInScene(npc as never, undefined), condicionFisica: 'HERIDO' };
    const bestia = await prisma.npc.findFirstOrThrow({ where: { worldId, saveId: null, faunaCategoria: { not: null } }, include: { items: { include: { item: true } } } });
    fauna = { ...buildNpcInScene(bestia as never, undefined), condicionFisica: 'HERIDO' };
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const base = () => ({ saveId, worldId, npcAttackHits: true, npcTargetNewCondicion: 'GRAVE' as const, condicionJugadorTras: 'ILESO' as const, nivelJugador: 1 });

  it('al caer a GRAVE tira moral: si falla y escapa, huye', async () => {
    const r = await decidirMoralTrasIntercambio(prisma, { ...base(), npc: guerrero, random: d20(1, 1, 20) });
    expect(r).toMatchObject({ huye: true, pierdeTurno: false });
    expect(r!.moral.modo).toBe('desventaja'); // grave contra una jugadora ilesa: va claramente perdiendo
  });

  it('si falla la moral y no escapa, pierde su próximo golpe; si aguanta, sigue', async () => {
    expect(await decidirMoralTrasIntercambio(prisma, { ...base(), npc: guerrero, random: d20(1, 1, 1) })).toMatchObject({ huye: false, pierdeTurno: true });
    expect(await decidirMoralTrasIntercambio(prisma, { ...base(), npc: guerrero, random: d20(20, 20) })).toMatchObject({ huye: false, pierdeTurno: false });
  });

  it('no tira: sin golpe a GRAVE, la fauna, ni el objetivo de una misión activa', async () => {
    expect(await decidirMoralTrasIntercambio(prisma, { ...base(), npc: guerrero, npcTargetNewCondicion: 'HERIDO', random: d20(1) })).toBeNull();
    expect(await decidirMoralTrasIntercambio(prisma, { ...base(), npc: fauna, random: d20(1) })).toBeNull();
    const q = await prisma.quest.create({ data: { saveId, title: 'Acaba con él', description: 'x', targetNpcId: guerrero.id } });
    expect(await decidirMoralTrasIntercambio(prisma, { ...base(), npc: guerrero, random: d20(1, 1, 20) })).toBeNull();
    await prisma.quest.delete({ where: { id: q.id } });
  });

  it('la huida lo saca de la zona por un tiempo y queda el suceso', async () => {
    await prisma.$transaction((tx) => aplicarHuidaNpc(tx, { saveId, npc: guerrero, characterName: 'Gorhorn', currentLocationId: lugarId, fictionalMinutes: 600 }));
    const estado = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: guerrero.id } });
    expect(estado.zonaAusenteHastaMinutes).toBeGreaterThan(600);
    expect(estado.zonaLocationId).toBe(lugarId);
    const suceso = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'HUIDA_DE_NPC' } });
    expect(suceso.texto).toBe('Guerrero serhu huye de Gorhorn.');
  });
});
