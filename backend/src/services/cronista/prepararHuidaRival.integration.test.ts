import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { abrirCombateDePersonas, type MiembroDeGrupo } from '../combatePersonas.js';
import { dejarRivalAPuntoDeHuir } from './prepararHuidaRival.js';

/// P443 (para ver su línea de huida): el paso `huida-rival` deja a un rival con moral GRAVE y sin moral tirada.
describe('P443 — huida-rival en el combate en curso', () => {
  let saveId: string;
  let worldId: string;
  let renegadoId: string;
  const ATR = { fuerza: 12, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };
  const SAVE = () => ({ id: saveId, characterName: 'Gorhorn', attributes: ATR, fictionalMinutes: 600, timeLabel: 'Día 1' });

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (huida P443)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: ATR, portraitInitial: 'G', currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 600, fictionalDateLabel: 'Día 1' } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    renegadoId = (await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'ulkha-ketg', saveId: null } })).id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin combate en curso lo rechaza diciendo por qué', async () => {
    const r = await dejarRivalAPuntoDeHuir(prisma, { saveId, npcSlug: null });
    expect(r).toEqual({ error: expect.stringContaining('no hay combate en curso') });
  });

  it('deja GRAVE al rival, sin moral tirada, y rechaza a quien no está', async () => {
    const rival: MiembroDeGrupo = { npcId: renegadoId, nombre: 'Ulkha Ketg', scope: '', destreza: 8, inteligencia: 20, esGrupo: true };
    expect(await abrirCombateDePersonas(prisma, SAVE(), [rival, rival])).not.toBeNull();
    const r = await dejarRivalAPuntoDeHuir(prisma, { saveId, npcSlug: null });
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.slug).toBe('ulkha-ketg');
    const graves = await prisma.combatParticipant.findMany({ where: { npcId: renegadoId, encounter: { saveId }, condicionFisicaGrupo: 'GRAVE' } });
    expect(graves).toHaveLength(1);
    expect(graves[0].moralTirada).toBe(false);
    const fuera = await dejarRivalAPuntoDeHuir(prisma, { saveId, npcSlug: 'no-existe-p443' });
    expect(fuera).toEqual({ error: expect.stringContaining('no es un rival') });
  });
});
