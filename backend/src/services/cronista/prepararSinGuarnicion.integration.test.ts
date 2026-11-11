import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { asentamientosDelReino, planMilicia } from '../defensaReino.js';
import { dejarSinGuarnicion } from './prepararSinGuarnicion.js';

// P427: paso `sin-guarnicion` de `prepararReino.ts` (un asalto que toma la Capital sin tocar la base a mano).
describe('paso sin-guarnicion de preparar (P427)', () => {
  const saveIds: string[] = [];

  async function partida(nombre: string, { conAyuntamiento = true } = {}) {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const casa = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'S',
        worldState: { create: { fictionalMinutes: 10 * 1440 } },
      },
    });
    saveIds.push(save.id);
    await prisma.kingdomStats.create({ data: { saveId: save.id, ownerKey: ownerKeyFor({ saveId: save.id }), riqueza: 100 } });
    const b = (recipeKey: string, extra: object = {}) => prisma.building.create({ data: { saveId: save.id, locationId: casa.id, recipeKey, name: recipeKey, kind: recipeKey, description: 'x', status: 'ACTIVO', tier: 1, ...extra } });
    const capital = conAyuntamiento ? await b('ayuntamiento') : null;
    await b('armeria', { equiposMilicia: 3 });
    for (const [i, role] of ['soldado', 'vigia', 'trabajador', 'trabajador'].entries()) {
      await prisma.subject.create({ data: { saveId: save.id, name: `${role} ${i}`, role, notes: '', enMilicia: i === 3 } });
    }
    return { saveId: save.id, capitalId: capital?.id ?? '' };
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('deja la Capital sin guarnición ni milicia que armar, sin borrar a nadie', async () => {
    const { saveId, capitalId } = await partida('Sin guarnición (P427)');
    expect((await prisma.$transaction((tx) => asentamientosDelReino(tx, saveId)))[0]!.guarnicion).toHaveLength(2);
    const r = await dejarSinGuarnicion(prisma, { saveId });
    expect(r).toEqual({ aTrabajador: ['soldado 0', 'vigia 1'], licenciados: 1, equiposQuitados: 1, guardias: 0 });
    expect((await prisma.$transaction((tx) => asentamientosDelReino(tx, saveId)))[0]!.guarnicion).toHaveLength(0);
    expect(await prisma.subject.count({ where: { saveId, estado: 'ACTIVO' } })).toBe(4);
    expect(await prisma.subject.count({ where: { saveId, enMilicia: true } })).toBe(0);
    // Con la jugadora fuera, la vigilancia no puede armar a la milicia.
    const plan = await prisma.$transaction((tx) => planMilicia(tx, saveId, capitalId, 10 * 1440));
    expect(plan.llamados).toHaveLength(0);
    expect(plan.motivo).toMatch(/no tiene equipos/);
    // Repetirlo no cambia nada.
    expect(await dejarSinGuarnicion(prisma, { saveId })).toEqual({ aTrabajador: [], licenciados: 0, equiposQuitados: 0, guardias: 0 });
  });

  it('se niega sin Ayuntamiento, antes de escribir', async () => {
    const { saveId } = await partida('Sin Ayuntamiento (P427)', { conAyuntamiento: false });
    expect(await dejarSinGuarnicion(prisma, { saveId })).toEqual({ error: 'sin-guarnicion: el Reino no tiene Ayuntamiento activo.' });
    expect(await prisma.subject.count({ where: { saveId, role: 'soldado' } })).toBe(1);
    expect(await prisma.subject.count({ where: { saveId, enMilicia: true } })).toBe(1);
  });
});
