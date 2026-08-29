import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { sessionRoutes } from './session.js';

/// Ronda de correcciones 2026-08-28 (P3.2): "Huir DENTRO de combate debe tener riesgo real" — antes
/// se resolvía como un intercambio de ataque/defensa normal disfrazado (indistinguible de
/// Defenderse). El endpoint nuevo `combat/huir-en-curso` reutiliza la misma tirada determinista que
/// `/combat/flee` (pre-combate), pero un fallo aplica un golpe directo real sobre `condicionFisica`
/// SIN ninguna tirada de defensa — mismo patrón de candado de concurrencia que `/combat/flee` y
/// `/combat/dejar-vivir/:npcSlug`.
async function buildApp() {
  const app = Fastify();
  await app.register(sessionRoutes);
  return app;
}

describe('/combat/huir-en-curso', () => {
  let saveId: string;
  let npcSlug: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    npcSlug = npc.slug;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (huir en curso)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 18, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        portraitInitial: 'G',
        pendingCombatNpcSlugs: [npcSlug],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  beforeEach(async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingCombatNpcSlugs: [npcSlug], condicionFisica: 'ILESO' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('roll exitoso: escapa, limpia pendingCombatNpcSlugs, condicionFisica no cambia', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // d20 alto, éxito garantizado
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/huir-en-curso` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ escaped: true, condicionFisica: 'ILESO' });
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingCombatNpcSlugs).toEqual([]);
    expect(saveAfter.condicionFisica).toBe('ILESO');
  });

  it('roll fallido: no escapa, recibe un golpe directo (condicionFisica empeora un paso), combate sigue activo', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // d20 bajo, fallo garantizado
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/huir-en-curso` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ escaped: false, condicionFisica: 'HERIDO' });
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // El combate sigue en curso — un fallo al huir no lo cierra.
    expect(saveAfter.pendingCombatNpcSlugs).toEqual([npcSlug]);
    expect(saveAfter.condicionFisica).toBe('HERIDO');
  });

  it('rechaza con 409 si el jugador está CONVALECIENTE — sin posibilidad real de reacción a un fallo', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'CONVALECIENTE' } });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/huir-en-curso` });

    expect(res.statusCode).toBe(409);
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.condicionFisica).toBe('CONVALECIENTE');
  });

  it('rechaza con 404 si no hay ningún combate en curso (pendingCombatNpcSlugs vacío)', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [] } });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/huir-en-curso` });

    expect(res.statusCode).toBe(404);
  });

  it('condición de carrera: si pendingCombatNpcSlugs cambia mientras se calcula, aborta con 409 en vez de pisarlo', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const app = await buildApp();

    let resolveGotLock!: () => void;
    const gotLock = new Promise<void>((resolve) => { resolveGotLock = resolve; });
    const competidor = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Save" WHERE id = ${saveId} FOR UPDATE`;
      resolveGotLock();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await tx.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [npcSlug, 'otro-npc-que-se-unio'] } });
    });
    await gotLock;
    const huirPromise = app.inject({ method: 'POST', url: `/saves/${saveId}/combat/huir-en-curso` });

    const [huirRes] = await Promise.all([huirPromise, competidor]);

    expect(huirRes.statusCode).toBe(409);
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingCombatNpcSlugs).toEqual([npcSlug, 'otro-npc-que-se-unio']);
  }, 20_000);
});
