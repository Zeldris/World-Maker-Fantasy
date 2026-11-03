import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { abrirCombateDePersonas, type MiembroDeGrupo } from '../combatePersonas.js';
import { dejarHeridoEnCombate } from './prepararHerido.js';

/// P370 (para ver P292): el paso `herido:<npc>` deja a un compañero del combate en curso GRAVE o HERIDO.
describe('P370 — herido:<npc> en el combate en curso', () => {
  let saveId: string;
  let worldId: string;
  let renegadoId: string;
  let companeroId: string;
  const ATR = { fuerza: 12, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };
  const SAVE = () => ({ id: saveId, characterName: 'Gorhorn', attributes: ATR, fictionalMinutes: 600, timeLabel: 'Día 1' });

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (herido P370)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: ATR, portraitInitial: 'G', currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 600, fictionalDateLabel: 'Día 1' } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    // Ulkha Ketg (Inteligencia 20 en su ficha): el capitán se recalcula con la ficha, no con el miembro del grupo.
    renegadoId = (await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'ulkha-ketg', saveId: null } })).id;
    companeroId = (await prisma.companion.create({
      data: { saveId, name: 'Hagar (P370)', role: 'x', notes: 'x', sourceSlug: 'hagar-p370', attributes: { ...ATR, constitucion: 14 }, aprobacion: 80, combatGroupSlotIndex: 0 },
    })).id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin combate en curso lo rechaza diciendo por qué', async () => {
    const r = await dejarHeridoEnCombate(prisma, { saveId, npcSlug: 'hagar-p370', condicion: 'GRAVE' });
    expect(r).toEqual({ error: expect.stringContaining('no hay combate en curso') });
  });

  it('deja GRAVE al compañero del combate, en su ficha, y rechaza a quien no está', async () => {
    const capitan: MiembroDeGrupo = { npcId: renegadoId, nombre: 'Ulkha Ketg', scope: '', destreza: 8, inteligencia: 20, esGrupo: true };
    expect(await abrirCombateDePersonas(prisma, SAVE(), [capitan, capitan])).not.toBeNull();
    // P393: con todos ilesos el capitán abre sobre Gorhorn (menos Constitución); herido Hagar, la orden pasa a él ya.
    const encuentro = await prisma.combatEncounter.findFirstOrThrow({ where: { saveId, estado: 'EN_CURSO' }, include: { participantes: true } });
    const gorhornP = encuentro.participantes.find((p) => p.tipo === 'JUGADOR')!;
    const hagarP = encuentro.participantes.find((p) => p.companionId === companeroId)!;
    expect(encuentro.objetivoCapitanId).toBe(gorhornP.id);
    const r = await dejarHeridoEnCombate(prisma, { saveId, npcSlug: 'hagar-p370', condicion: 'GRAVE' });
    expect(r).toEqual({ nombre: 'Hagar (P370)', condicion: 'GRAVE', bando: 'JUGADOR', ordenaCaerSobre: 'Hagar (P370)' });
    const tras = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encuentro.id }, include: { participantes: true } });
    expect(tras.objetivoCapitanId).toBe(hagarP.id);
    expect(tras.participantes.filter((p) => p.bando === 'ENEMIGO').map((p) => p.objetivoActualId)).toEqual([hagarP.id, hagarP.id]);
    expect(await prisma.logEntry.count({ where: { saveId, text: { endsWith: 'ordena caer sobre Hagar (P370).' } } })).toBe(1);
    expect((await prisma.companion.findUniqueOrThrow({ where: { id: companeroId } })).condicionFisica).toBe('GRAVE');
    const fuera = await dejarHeridoEnCombate(prisma, { saveId, npcSlug: 'no-existe-p370', condicion: 'HERIDO' });
    expect(fuera).toEqual({ error: expect.stringContaining('no está en el combate en curso') });
  });
});
