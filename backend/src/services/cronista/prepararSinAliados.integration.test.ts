import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { dejarSinAliados } from './prepararSinAliados.js';
import { moverCompaneroDeGrupo } from '../combatGroups.js';

// QA-266 (P128): el paso `sin-aliados` de `prepararReino.ts` saca a los compañeros del Grupo 1 con la regla del arrastre del
// panel, para que el combate que se abra después lleve solo a la jugadora (`abrirCombateDePersonas` mira el slot 0).
describe('dejarSinAliados (QA-266, P128)', () => {
  const saveIds: string[] = [];

  async function partida(nombre: string, opciones: { endedAt?: Date } = {}) {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId: world.id }, orderBy: { slug: 'asc' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'cazador', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'Q',
        currentLocationId: lugar.id, endedAt: opciones.endedAt ?? null,
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return { saveId: save.id };
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  const nuevo = (saveId: string, name: string) => prisma.companion.create({ data: { saveId, name, role: 'aliado', notes: '', combatGroupSlotIndex: 0 } });

  it('saca a todos los compañeros del Grupo 1 a un grupo nuevo y es idempotente', async () => {
    const { saveId } = await partida('Sin aliados (QA-266)');
    await nuevo(saveId, 'Uno');
    await nuevo(saveId, 'Dos');
    const r = await dejarSinAliados(prisma, { saveId });
    expect(r).toMatchObject({ yaEstaba: false, grupos: [1] });
    expect('movidos' in r && r.movidos.sort()).toEqual(['Dos', 'Uno']);
    expect(await prisma.companion.count({ where: { saveId, combatGroupSlotIndex: 0 } })).toBe(0);
    expect(await prisma.companion.count({ where: { saveId, combatGroupSlotIndex: 1 } })).toBe(2);
    expect(await prisma.combatGroup.count({ where: { saveId, slotIndex: 1 } })).toBe(1);
    expect(await dejarSinAliados(prisma, { saveId })).toEqual({ movidos: [], grupos: [], yaEstaba: true });
    expect(await prisma.combatGroup.count({ where: { saveId } })).toBe(1);
  });

  it('con más de 4 compañeros abre otro grupo, sin pasar el tope por grupo', async () => {
    const { saveId } = await partida('Sin aliados 5 (QA-266)');
    for (const n of ['A', 'B', 'C', 'D', 'E']) await nuevo(saveId, n);
    const r = await dejarSinAliados(prisma, { saveId });
    expect(r).toMatchObject({ yaEstaba: false, grupos: [1, 2] });
    expect(await prisma.companion.count({ where: { saveId, combatGroupSlotIndex: 1 } })).toBe(4);
    expect(await prisma.companion.count({ where: { saveId, combatGroupSlotIndex: 2 } })).toBe(1);
    expect(await prisma.companion.count({ where: { saveId, combatGroupSlotIndex: 0 } })).toBe(0);
  });

  it('una partida sin compañeros ya está sin aliados; rechaza la inexistente y la terminada', async () => {
    const { saveId } = await partida('Sin compañeros (QA-266)');
    expect(await dejarSinAliados(prisma, { saveId })).toMatchObject({ yaEstaba: true });
    expect(await dejarSinAliados(prisma, { saveId: 'no-existe' })).toEqual({ error: 'sin-aliados: no hay partida no-existe.' });
    const { saveId: fin } = await partida('Terminada (QA-266)', { endedAt: new Date() });
    await nuevo(fin, 'Fiel');
    expect(await dejarSinAliados(prisma, { saveId: fin })).toEqual({ error: 'sin-aliados: la partida ha terminado.' });
    expect(await prisma.companion.count({ where: { saveId: fin, combatGroupSlotIndex: 0 } })).toBe(1);
  });

  it('moverCompaneroDeGrupo respeta el tope del Grupo 1 y los límites (slot inválido, compañero ajeno)', async () => {
    const { saveId } = await partida('Mover (QA-266)');
    const cs = [];
    for (const n of ['A', 'B', 'C', 'D']) cs.push(await nuevo(saveId, n));
    await prisma.companion.updateMany({ where: { saveId }, data: { combatGroupSlotIndex: 1 } });
    for (const c of cs.slice(0, 3)) expect(await moverCompaneroDeGrupo(prisma, { saveId, companionId: c.id, slotIndex: 0 })).toMatchObject({ ok: true });
    expect(await moverCompaneroDeGrupo(prisma, { saveId, companionId: cs[3]!.id, slotIndex: 0 })).toMatchObject({ ok: false, status: 400 });
    expect(await moverCompaneroDeGrupo(prisma, { saveId, companionId: cs[3]!.id, slotIndex: -1 })).toMatchObject({ ok: false, status: 400 });
    expect(await moverCompaneroDeGrupo(prisma, { saveId, companionId: 'no-existe', slotIndex: 1 })).toMatchObject({ ok: false, status: 404 });
  });
});
