import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { dejarDomableEnJaula } from './prepararDoma.js';
import { CONSTRUCTION_RECIPES } from '../construction.js';

// QA-269 (CR-55): el paso `domable:<especie>` de `prepararReino.ts`, contra una partida real.
describe('dejarDomableEnJaula (QA-269, CR-55)', () => {
  const saveIds: string[] = [];

  async function partida(nombre: string, jaulas: string[]) {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'cazador', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'Q',
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    for (const key of jaulas) {
      const receta = CONSTRUCTION_RECIPES.find((r) => r.key === key)!;
      await prisma.building.create({ data: { saveId: save.id, recipeKey: key, name: receta.name, kind: key, description: receta.description, status: 'ACTIVO' } });
    }
    return save.id;
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('deja el animal capturado y atado en la Jaula, con felicidad 0, y la jaula queda ocupada', async () => {
    const saveId = await partida('Domable (QA-269)', ['jaula-mediana']);
    const r = await dejarDomableEnJaula(prisma, { saveId, especie: 'corretolvas' });
    expect(r).toMatchObject({ especie: 'corretolvas' });
    const jaula = await prisma.building.findFirstOrThrow({ where: { saveId, recipeKey: 'jaula-mediana' } });
    const estado = await prisma.npcState.findFirstOrThrow({ where: { saveId, capturado: true }, include: { npc: true } });
    expect(estado).toMatchObject({ condicionFisica: 'GRAVE', capturaFelicidad: 0, capturaJaulaBuildingId: jaula.id });
    expect(estado.npc.slug).toBe('corretolvas');
    // La jaula ya no está libre: un segundo animal no cabe.
    expect(await dejarDomableEnJaula(prisma, { saveId, especie: 'corretolvas' })).toEqual({ error: expect.stringContaining('no hay Jaula libre') });
    expect(await prisma.npcState.count({ where: { saveId, capturado: true } })).toBe(1);
  });

  it('se niega, con el motivo, sin Jaula apta, con una especie que no es ganado o que no existe', async () => {
    const saveId = await partida('Sin jaula (QA-269)', ['jaula-pequena']);
    expect(await dejarDomableEnJaula(prisma, { saveId, especie: 'murgol' })).toEqual({ error: expect.stringContaining('no hay Jaula libre') }); // el múrgol pide la grande
    expect(await dejarDomableEnJaula(prisma, { saveId, especie: 'lobo-gris' })).toEqual({ error: expect.stringContaining('no es una especie de ganado') });
    expect(await dejarDomableEnJaula(prisma, { saveId: 'no-existe', especie: 'murgol' })).toEqual({ error: expect.stringContaining('no hay partida') });
    expect(await prisma.npcState.count({ where: { saveId, capturado: true } })).toBe(0);
  });
});
