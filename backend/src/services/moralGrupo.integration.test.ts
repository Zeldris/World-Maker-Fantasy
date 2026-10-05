import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { abrirCombateDePersonas, type MiembroDeGrupo } from './combatePersonas.js';
import { revisarMoralDelCombate, type CombatienteParaMoral } from './moralGrupo.js';

/// `random` que da esos d20, en orden.
const d20 = (...valores: number[]) => {
  let i = 0;
  return () => (valores[i++ % valores.length]! - 1) / 20;
};

/// CR-44 (44c): moral del bando enemigo en el combate de varios.
describe('CR-44 (44c) — moral en el combate de varios', () => {
  let saveId: string;
  let renegadoId: string;
  const ATR = { fuerza: 12, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (moral grupo)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: ATR, portraitInitial: 'G', currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 600, fictionalDateLabel: 'Día 1' } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    renegadoId = (await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'goirnte-renegado', saveId: null } })).id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  async function bandaDeTres(): Promise<CombatienteParaMoral[]> {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    const miembro: MiembroDeGrupo = { npcId: renegadoId, nombre: 'Goirnte Renegado', scope: '', destreza: 8, inteligencia: 8, esGrupo: true };
    const { encounterId } = (await abrirCombateDePersonas(prisma, { id: saveId, characterName: 'Gorhorn', attributes: ATR, fictionalMinutes: 600, timeLabel: 'Día 1' }, [miembro, miembro, miembro]))!;
    const ps = await prisma.combatParticipant.findMany({ where: { encounterId }, orderBy: { createdAt: 'asc' } });
    return ps.map((p) => ({
      participantId: p.id, bando: p.bando, tipo: p.tipo, npcId: p.npcId, esGrupo: p.condicionFisicaGrupo !== null, huido: false, moralTirada: false,
      condicion: 'ILESO', attributes: p.tipo === 'NPC' ? { ...ATR, inteligencia: 14 } : ATR,
    }));
  }
  const enemigos = (cs: CombatienteParaMoral[]) => cs.filter((c) => c.bando === 'ENEMIGO');

  it('sin caídos ni graves nuevos no tira nadie', async () => {
    const cs = await bandaDeTres();
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    expect(await revisarMoralDelCombate(prisma as never, { saveId, encounterId, combatientes: cs, random: d20(1) })).toEqual({ huidos: [], textos: [] });
  });

  it('a la mitad, el líder (Int ≥ 12) ordena la retirada: si escapa, se van todos los que siguen en pie, y solo tira una vez', async () => {
    const cs = await bandaDeTres();
    const [a, b] = enemigos(cs);
    a!.condicion = 'CONVALECIENTE';
    b!.condicion = 'MUERTO';
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    const r = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(1, 1, 20) }));
    expect(r.huidos).toHaveLength(1);
    expect(r.textos[0]).toContain('escapa');
    expect((await prisma.combatParticipant.findUniqueOrThrow({ where: { id: r.huidos[0]! } })).huido).toBe(true);
    // Ya tiró por quedar a la mitad: no vuelve a tirar.
    const otra = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(1, 1, 20) }));
    expect(otra.huidos).toEqual([]);
  });

  it('caer a GRAVE por primera vez hace tirar; si aguanta, siguen peleando', async () => {
    const cs = await bandaDeTres();
    enemigos(cs)[0]!.condicion = 'GRAVE';
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    const r = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(20, 20) }));
    expect(r.huidos).toEqual([]);
    expect(r.textos[0]).toContain('siguen peleando');
  });

  it('CR-45: si cae el capitán (Int ≥ 20), los suyos tiran con desventaja, una sola vez', async () => {
    const cs = await bandaDeTres();
    const [capitan, ...resto] = enemigos(cs);
    capitan!.attributes = { ...capitan!.attributes!, inteligencia: 20 };
    capitan!.condicion = 'CONVALECIENTE';
    for (const m of resto) m.attributes = { ...m.attributes!, inteligencia: 8 };
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    // Desbandada (Int 8): cada uno tira moral con desventaja (2 dados) y, si falla, escape.
    const r = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(1, 1, 20) }));
    expect(r.textos[0]).toContain('sin quien los mande');
    expect(r.huidos.length).toBeGreaterThan(0);
    const otra = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs.map((c) => (r.huidos.includes(c.participantId) ? { ...c, huido: true } : c)), random: d20(1, 1, 20) }));
    expect(otra.textos.some((t) => t.includes('sin quien los mande'))).toBe(false);
  });
});
