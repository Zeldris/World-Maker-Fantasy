import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { sessionRoutes } from './session.js';

/// Cobertura nueva (auditoría de código 2026-08-25, condición de carrera real): `/combat/flee` leía
/// `pendingCombatNpcSlugs` al principio y lo limpiaba al final sin comprobar que siguiera siendo el
/// mismo — un turno real de combate resolviéndose en paralelo (protegido por `claimTurnInFlight`,
/// pero esta ruta no pasa por ahí) podía actualizar ese campo justo en la ventana entre medias, y
/// `flee` lo pisaba en silencio. Arreglado bloqueando la fila de `Save` (`SELECT ... FOR UPDATE`) y
/// comparando el set fresco contra el que se leyó al principio antes de limpiar.
///
/// Simular la carrera real (flee vs. un turno de combate completo resolviéndose) exigiría montar
/// todo `narrateAndPersistTurn` en paralelo — en vez de eso, esta prueba fuerza la misma ventana
/// directamente contra Postgres: una transacción "competidora" agarra el lock de `Save` ANTES que
/// `flee` (que primero hace varias lecturas async sin lock: `findUnique`, `npc.findMany`, el cálculo
/// del roll) y cambia `pendingCombatNpcSlugs` a un set distinto mientras lo retiene — cuando `flee`
/// por fin consigue su propio `FOR UPDATE`, debe ver ya el cambio y abortar en vez de pisarlo.
async function buildApp() {
  const app = Fastify();
  await app.register(sessionRoutes);
  return app;
}

describe('/combat/flee: condición de carrera con una escritura paralela de pendingCombatNpcSlugs (auditoría de código 2026-08-25)', () => {
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
        characterName: 'Gorhorn de prueba (flee, condición de carrera)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 18, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        pendingCombatNpcSlugs: [npcSlug],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('si pendingCombatNpcSlugs cambia mientras se calcula la huida, no lo pisa — aborta con 409', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // roll de huida garantizado en éxito (d20 alto)
    const app = await buildApp();

    // Sincronización manual (no basta con lanzar las dos promesas a la vez: `flee` hace varias
    // lecturas async propias antes de llegar a su `FOR UPDATE`, y el orden real de quién llega
    // primero a bloquear la fila no está garantizado solo por orden de creación de las promesas) —
    // se espera explícitamente a que el competidor YA tenga el lock antes de lanzar `flee`, así se
    // fuerza la ventana real sin depender de timing.
    let resolveGotLock!: () => void;
    const gotLock = new Promise<void>((resolve) => { resolveGotLock = resolve; });
    const competidor = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Save" WHERE id = ${saveId} FOR UPDATE`;
      resolveGotLock();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await tx.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [npcSlug, 'otro-npc-que-se-unio'] } });
    });
    await gotLock;
    const fleePromise = app.inject({ method: 'POST', url: `/saves/${saveId}/combat/flee` });

    const [fleeRes] = await Promise.all([fleePromise, competidor]);

    expect(fleeRes.statusCode).toBe(409);
    // El cambio del competidor (el set con el NPC nuevo) sigue en pie — flee no lo pisó.
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingCombatNpcSlugs).toEqual([npcSlug, 'otro-npc-que-se-unio']);
  }, 20_000);

  it('BUG CERRADO (auditoría 2026-09-01): si la propia tirada de huida FALLA, también se compara contra el estado fresco antes de escribir el LogEntry — antes se persistía siempre, sin comprobar', async () => {
    // Antes de este fix, el guard `if (roll.success && !mismoSet)` solo abortaba cuando la tirada
    // TENÍA éxito — una tirada fallida se persistía siempre, sin comparar contra pendingCombatNpcSlugs
    // fresco, aunque el combate ya hubiera cambiado (p.ej. resuelto por la otra mitad de un doble
    // clic). Esta prueba fuerza un roll fallido (destreza baja) con la misma carrera que el test de
    // arriba, y confirma que ahora también aborta con 409 sin crear el LogEntry.
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [npcSlug], attributes: { fuerza: 1, destreza: 1, constitucion: 1, inteligencia: 1, voluntad: 1, carisma: 1, magia: 1 } } });
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // roll de huida garantizado en fallo (d20 bajo)
    const app = await buildApp();
    const logCountAntes = await prisma.logEntry.count({ where: { saveId } });

    let resolveGotLock!: () => void;
    const gotLock = new Promise<void>((resolve) => { resolveGotLock = resolve; });
    const competidor = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Save" WHERE id = ${saveId} FOR UPDATE`;
      resolveGotLock();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await tx.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [npcSlug, 'otro-npc-que-se-unio'] } });
    });
    await gotLock;
    const fleePromise = app.inject({ method: 'POST', url: `/saves/${saveId}/combat/flee` });

    const [fleeRes] = await Promise.all([fleePromise, competidor]);

    expect(fleeRes.statusCode).toBe(409);
    const logCountDespues = await prisma.logEntry.count({ where: { saveId } });
    expect(logCountDespues).toBe(logCountAntes);
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingCombatNpcSlugs).toEqual([npcSlug, 'otro-npc-que-se-unio']);

    // Restaura atributos altos para no afectar al resto de tests de este describe.
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { fuerza: 10, destreza: 18, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 } } });
  }, 20_000);

  it('sin ninguna carrera, un roll de huida exitoso sigue limpiando pendingCombatNpcSlugs con normalidad', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [npcSlug], zonaPosX: 40, zonaPosY: 60, zonaPosEntradaX: 12, zonaPosEntradaY: 88 } });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/flee` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ escaped: true });
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingCombatNpcSlugs).toEqual([]);
    // Tras huir reaparece en la entrada de la zona.
    expect({ x: saveAfter.zonaPosX, y: saveAfter.zonaPosY }).toEqual({ x: 12, y: 88 });
  });
});
