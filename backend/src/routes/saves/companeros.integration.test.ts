import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { companerosRoutes } from './companeros.js';

/// Cobertura nueva (auditoría de código 2026-08-25, condición de carrera real): la ruta
/// `/tameo-pendientes/:npcSlug/confirmar` no pasa por `claimTurnInFlight` (exclusivo de
/// `/turn/narrate`) — leía `companionCount`/`esSlotDomador` ANTES de escribir nada, así que dos
/// confirmaciones casi simultáneas (dos capturas pendientes distintas) podían pasar ambas el check
/// del tope de slots y crear ambas su Companion. Arreglado bloqueando la fila de `Save` con
/// `SELECT ... FOR UPDATE` dentro de una transacción (mismo patrón que `progression.ts` §
/// `/attribute-points`) — este test dispara las dos confirmaciones a la vez con `Promise.all` para
/// comprobarlo contra Postgres de verdad, no solo leyendo el código.
async function buildApp() {
  const app = Fastify();
  await app.register(companerosRoutes);
  return app;
}

describe('Compañeros: condición de carrera en confirmaciones concurrentes (auditoría de código 2026-08-25)', () => {
  let saveId: string;
  let auladorId: string;
  let corretolvasId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const aullador = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    const corretolvas = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'corretolvas' } });
    auladorId = aullador.id;
    corretolvasId = corretolvas.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (compañeros, condición de carrera)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;

    // Exactamente 1 slot de compañero real (recipeKey 'campamento' = companionSlots: 1,
    // construction.ts) — sin pasar por un turno completo, mismo atajo que otros describe de
    // condición de carrera de este proyecto (seedear el estado directo, no simular la narración).
    await prisma.building.create({
      data: { saveId, recipeKey: 'campamento', name: 'Campamento', kind: 'refugio', status: 'ACTIVO', description: 'x' },
    });

    // 2 capturas pendientes DISTINTAS, ambas ya con Felicidad suficiente para confirmar (umbral
    // general 80, FELICIDAD_UMBRAL_GENERAL en companionSupervivencia.ts) — el escenario real del
    // hallazgo: dos NPC distintos confirmados a la vez, no el mismo dos veces.
    await prisma.npcState.create({ data: { saveId, npcId: auladorId, scope: '', condicionFisica: 'ILESO', capturado: true, capturaFelicidad: 90 } });
    await prisma.npcState.create({ data: { saveId, npcId: corretolvasId, scope: '', condicionFisica: 'ILESO', capturado: true, capturaFelicidad: 90 } });
  });

  afterAll(async () => {
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.building.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('con 1 solo slot real, confirmar 2 capturas distintas a la vez crea como mucho 1 Companion', async () => {
    const app = await buildApp();
    const [resA, resB] = await Promise.all([
      app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/aullador-rojo/confirmar`, payload: {} }),
      app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/corretolvas/confirmar`, payload: {} }),
    ]);

    const codes = [resA.statusCode, resB.statusCode].sort();
    expect(codes).toEqual([200, 409]); // una gana el hueco, la otra se suelta sin hueco
    expect(await prisma.companion.count({ where: { saveId } })).toBe(1);
  }, 20_000);
});
