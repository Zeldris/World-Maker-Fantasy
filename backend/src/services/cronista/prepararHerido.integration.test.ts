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
    renegadoId = (await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'goirnte-renegado', saveId: null } })).id;
    companeroId = (await prisma.companion.create({
      data: { saveId, name: 'Hagar (P370)', role: 'x', notes: 'x', sourceSlug: 'hagar-p370', attributes: ATR, aprobacion: 80, combatGroupSlotIndex: 0 },
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
    const capitan: MiembroDeGrupo = { npcId: renegadoId, nombre: 'Goirnte Renegado', scope: '', destreza: 8, inteligencia: 20, esGrupo: true };
    expect(await abrirCombateDePersonas(prisma, SAVE(), [capitan, capitan])).not.toBeNull();
    const r = await dejarHeridoEnCombate(prisma, { saveId, npcSlug: 'hagar-p370', condicion: 'GRAVE' });
    expect(r).toEqual({ nombre: 'Hagar (P370)', condicion: 'GRAVE', bando: 'JUGADOR' });
    expect((await prisma.companion.findUniqueOrThrow({ where: { id: companeroId } })).condicionFisica).toBe('GRAVE');
    const fuera = await dejarHeridoEnCombate(prisma, { saveId, npcSlug: 'no-existe-p370', condicion: 'HERIDO' });
    expect(fuera).toEqual({ error: expect.stringContaining('no está en el combate en curso') });
  });
});
