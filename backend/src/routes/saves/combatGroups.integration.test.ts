import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { combatGroupsRoutes } from './combatGroups.js';

/// Grupos de combate (2026-09-08) — CRUD de CombatGroup + mover Companion entre grupos. Mismo
/// patrón de setup que skillBars.integration.test.ts.
async function buildApp() {
  const app = Fastify();
  await app.register(combatGroupsRoutes);
  return app;
}

const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };
const COMPANION_ATTRS = { fuerza: 6, destreza: 8, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 };

describe('Grupos de combate (2026-09-08)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (grupos de combate CRUD)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.combatGroup.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET sin ningún compañero ni grupo creado: solo el Grupo 1 implícito, vacío', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/combat-groups` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.groups).toEqual([{ slotIndex: 0, name: 'Grupo 1', esBase: true, companions: [] }]);
  });

  it('un compañero recién creado aparece en el Grupo 1 por defecto (combatGroupSlotIndex: 0)', async () => {
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Ceniza', role: 'mascota', notes: '', tipo: 'FAUNA', sourceSlug: 'zense-ceniza', attributes: COMPANION_ATTRS },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/combat-groups` });
    const body = res.json();
    const grupo1 = body.groups.find((g: { slotIndex: number }) => g.slotIndex === 0);
    expect(grupo1.companions.map((c: { id: string }) => c.id)).toContain(companion.id);
  });

  it('POST crea un grupo nuevo con el siguiente slotIndex libre, nunca reutiliza el 0', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat-groups` });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.slotIndex).toBe(1);
    expect(body.name).toBe('Grupo 2');
  });

  it('PATCH renombra un grupo ya creado', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'PATCH', url: `/saves/${saveId}/combat-groups/1`, payload: { name: 'Vanguardia' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Vanguardia');
  });

  it('PATCH renombra el Grupo 1 implícito por primera vez (upsert)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'PATCH', url: `/saves/${saveId}/combat-groups/0`, payload: { name: 'Grupo Principal' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Grupo Principal');

    const getRes = await app.inject({ method: 'GET', url: `/saves/${saveId}/combat-groups` });
    const grupo1 = getRes.json().groups.find((g: { slotIndex: number }) => g.slotIndex === 0);
    expect(grupo1.name).toBe('Grupo Principal');
  });

  it('PATCH /companeros/:id/grupo mueve un compañero al grupo indicado', async () => {
    const companion = await prisma.companion.findFirstOrThrow({ where: { saveId, name: 'Ceniza' } });
    const app = await buildApp();
    const res = await app.inject({ method: 'PATCH', url: `/saves/${saveId}/companeros/${companion.id}/grupo`, payload: { combatGroupSlotIndex: 1 } });
    expect(res.statusCode).toBe(200);
    expect(res.json().combatGroupSlotIndex).toBe(1);

    const getRes = await app.inject({ method: 'GET', url: `/saves/${saveId}/combat-groups` });
    const grupos = getRes.json().groups;
    expect(grupos.find((g: { slotIndex: number }) => g.slotIndex === 0).companions).toHaveLength(0);
    expect(grupos.find((g: { slotIndex: number }) => g.slotIndex === 1).companions.map((c: { id: string }) => c.id)).toContain(companion.id);
  });

  it('DELETE del Grupo 1 se rechaza (base, no se puede borrar)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: `/saves/${saveId}/combat-groups/0` });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE de un grupo con compañeros dentro los devuelve al Grupo 1', async () => {
    const companion = await prisma.companion.findFirstOrThrow({ where: { saveId, name: 'Ceniza' } });
    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: `/saves/${saveId}/combat-groups/1` });
    expect(res.statusCode).toBe(204);

    const refreshed = await prisma.companion.findUniqueOrThrow({ where: { id: companion.id } });
    expect(refreshed.combatGroupSlotIndex).toBe(0);
    expect(await prisma.combatGroup.findFirst({ where: { saveId, slotIndex: 1 } })).toBeNull();
  });

  it('PATCH /companeros/:id/grupo rechaza mover a un grupo ya lleno (tope de combatientes por bando)', async () => {
    // El Grupo 1 ya tiene 1 hueco ocupado (el propio PJ) — tope real MAX_COMBATIENTES_POR_BANDO
    // (4) menos 1 = 3 compañeros como máximo antes de llenarlo.
    const companions = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        prisma.companion.create({
          data: { saveId, name: `Extra ${i}`, role: 'mascota', notes: '', tipo: 'FAUNA', sourceSlug: 'gesgurio', attributes: COMPANION_ATTRS, combatGroupSlotIndex: 0 },
        }),
      ),
    );
    const uno_mas = await prisma.companion.create({
      data: { saveId, name: 'Cuarto extra', role: 'mascota', notes: '', tipo: 'FAUNA', sourceSlug: 'ruptidar', attributes: COMPANION_ATTRS, combatGroupSlotIndex: 5 },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'PATCH', url: `/saves/${saveId}/companeros/${uno_mas.id}/grupo`, payload: { combatGroupSlotIndex: 0 } });
    expect(res.statusCode).toBe(400);

    await prisma.companion.deleteMany({ where: { id: { in: [...companions.map((c) => c.id), uno_mas.id] } } });
  });
});
