import { describe, it, expect, vi, afterAll } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { detailRoutes } from '../../routes/saves/detail.js';
import { sessionRoutes } from '../../routes/saves/session.js';
import type { NarrationResult } from '../narrador.js';
import { abrirCombate1v1 } from './prepararCombate1v1.js';

// QA-293 (P373): el paso `combate1v1:<npc>` de `prepararReino.ts`, contra una partida real. Lo que se comprueba es lo que
// ve la usuaria: el Brozán (que no vive en la zona de la partida) se lanza contra ella, `GET /saves/:id` devuelve
// `combateIniciado` con él (el panel sale al cargar) y el turno siguiente con un ataque entra en el combate 1v1 clásico
// (`combateActivo`, un intercambio con sus dos tiradas), sin `CombatEncounter`. Solo se mockea la frontera del LLM, como
// en `turn.integration.test.ts`.
const narrateAction = vi.fn(async (ctx: { onNarrationChunk?: (d: string) => void }): Promise<NarrationResult> => {
  ctx.onNarrationChunk?.('El golpe conecta.');
  return { narration: 'El golpe conecta.', newFacts: [] };
});
vi.mock('../narrador.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../narrador.js')>()),
  classifyAction: vi.fn(),
  narrateAction: (ctx: Parameters<typeof narrateAction>[0]) => narrateAction(ctx),
}));
vi.mock('../combateMultipleNarracion.js', () => ({ narrarTurnoCombateMultiple: async () => 'Narración de prueba.' }));
vi.mock('../travelInterruption.js', () => ({ pickTravelInterruption: () => null }));

const { turnRoutes } = await import('../../routes/turn.js');

describe('abrirCombate1v1 (QA-293, P373)', () => {
  const saveIds: string[] = [];

  async function partida(nombre: string, opciones: { endedAt?: Date } = {}) {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 15, destreza: 10, constitucion: 12, inteligencia: 8, voluntad: 8, carisma: 8, magia: 4 }, portraitInitial: 'Q',
        currentLocationId: lugar.id, endedAt: opciones.endedAt ?? null,
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return save.id;
  }

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('el Brozán se lanza contra ella: sale en GET /saves/:id y el ataque siguiente es un intercambio 1v1 contra él', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const saveId = await partida('Combate 1v1 (QA-293)');
    const brozan = await prisma.npc.findFirstOrThrow({ where: { slug: 'brozan', saveId: null } });

    expect(await abrirCombate1v1(prisma, { saveId, npcSlug: 'brozan' })).toMatchObject({ nombre: brozan.name });
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual(['brozan']);
    expect(await prisma.combatEncounter.count({ where: { saveId } })).toBe(0); // 1v1, no de grupo
    expect(await prisma.logEntry.count({ where: { saveId, text: `${brozan.name} se lanza contra ti.` } })).toBe(1);

    const detalle = Fastify();
    await detalle.register(detailRoutes);
    const res = await detalle.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().combateIniciado).toMatchObject({ npcs: [{ slug: 'brozan' }] });

    const app = Fastify();
    await app.register(turnRoutes);
    await app.register(sessionRoutes);
    const action = 'Descargo un golpe directo con todo el peso de mi arma detrás.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    expect(classifyRes.statusCode).toBe(200);
    const { classification, roll, npcsInScene } = classifyRes.json();
    expect(npcsInScene.map((n: { slug: string }) => n.slug)).toContain('brozan');
    const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: true, npcsInScene } });
    expect(narrateRes.statusCode).toBe(200);

    // Hubo intercambio (las dos tiradas, guardadas en el diario) y el Brozán sigue en el combate 1v1.
    expect(await prisma.logEntry.count({ where: { saveId, NOT: { combatExchange: { equals: Prisma.DbNull } } } })).toBeGreaterThan(0);
    const estado = await prisma.npcState.findFirst({ where: { saveId, npcId: brozan.id } });
    expect(estado?.condicionFisica).not.toBe('ILESO'); // dados al máximo: golpes mutuos, el golpe le llega
    if (estado?.condicionFisica !== 'MUERTO') expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).pendingCombatNpcSlugs).toContain('brozan');
    expect(await prisma.combatEncounter.count({ where: { saveId } })).toBe(0);
  }, 30_000);

  it('se niega, con el motivo, con un combate en curso, un NPC que no existe o una partida terminada', async () => {
    const terminada = await partida('Terminada (QA-293)', { endedAt: new Date() });
    expect(await abrirCombate1v1(prisma, { saveId: terminada, npcSlug: 'brozan' })).toEqual({ error: expect.stringContaining('ha terminado') });
    const viva = await partida('Rechazos (QA-293)');
    expect(await abrirCombate1v1(prisma, { saveId: viva, npcSlug: 'no-existe-especie' })).toEqual({ error: expect.stringContaining('no hay NPC') });
    await prisma.save.update({ where: { id: viva }, data: { pendingCombatNpcSlugs: ['aullador-rojo'] } });
    expect(await abrirCombate1v1(prisma, { saveId: viva, npcSlug: 'brozan' })).toEqual({ error: expect.stringContaining('ya hay un combate en curso') });
    await prisma.save.update({ where: { id: viva }, data: { pendingCombatNpcSlugs: [] } });
    await prisma.combatEncounter.create({ data: { saveId: viva, estado: 'EN_CURSO' } });
    expect(await abrirCombate1v1(prisma, { saveId: viva, npcSlug: 'brozan' })).toEqual({ error: expect.stringContaining('ya hay un combate en curso') });
    expect((await prisma.save.findUniqueOrThrow({ where: { id: viva } })).pendingCombatNpcSlugs).toEqual([]);
  });
});
