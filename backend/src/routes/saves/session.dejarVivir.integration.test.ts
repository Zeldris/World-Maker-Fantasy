import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { sessionRoutes } from './session.js';
import { iniciarCombatEncounter } from '../../services/combateMultipleOrquestacion.js';

/// CONVALECIENTE deja de ser "victoria automática" (petición explícita, 2026-08-26) — "Dejarlo
/// vivir" saca al NPC de `pendingCombatNpcSlugs` (deja de ser objetivo activo) pero NO toca
/// `condicionFisica`: se queda CONVALECIENTE de verdad, recupera solo con las horas de ficción.
async function buildApp() {
  const app = Fastify();
  await app.register(sessionRoutes);
  return app;
}

describe('POST /saves/:id/combat/dejar-vivir/:npcSlug', () => {
  let saveId: string;
  let npcId: string;
  const npcSlug = 'orco-enfurecido-hondonada';

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: npcSlug } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (dejar vivir)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: location.id,
        pendingCombatNpcSlugs: [npcSlug, 'otro-npc-cualquiera'],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('400 si el NPC todavía no está CONVALECIENTE', async () => {
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId, scope: '' } },
      create: { saveId, npcId, scope: '', condicionFisica: 'HERIDO' },
      update: { condicionFisica: 'HERIDO' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/${npcSlug}` });
    expect(res.statusCode).toBe(400);

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual([npcSlug, 'otro-npc-cualquiera']);
  });

  it('CONVALECIENTE: saca solo a ese NPC de pendingCombatNpcSlugs, sin tocar su condicionFisica ni al resto', async () => {
    await prisma.npcState.update({
      where: { saveId_npcId_scope: { saveId, npcId, scope: '' } },
      data: { condicionFisica: 'CONVALECIENTE' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/${npcSlug}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().npcSlug).toBe(npcSlug);

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual(['otro-npc-cualquiera']);

    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.condicionFisica).toBe('CONVALECIENTE');

    const logEntry = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
    expect(logEntry.text).toContain('deja con vida a Orco enfurecido');
  });

  it('dejar vivir dos veces al mismo NPC no revienta (ya no está en pendingCombatNpcSlugs, pero sigue CONVALECIENTE)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/${npcSlug}` });
    expect(res.statusCode).toBe(200);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual(['otro-npc-cualquiera']);
  });
});

// BUG CERRADO (2026-08-29, ver comentario de `CombatParticipant.dismissedGrupo` en schema.prisma):
// dentro de un `CombatEncounter` real (combate múltiple), la condición vive en
// `CombatParticipant.condicionFisicaGrupo`, no en `NpcState` (fila compartida por toda la especie)
// — el camino sin `participantId` de arriba nunca la resolvía bien para un miembro de grupo. Con
// `participantId`, Clemente ahora marca `dismissedGrupo: true` en el propio `CombatParticipant`, la
// señal que `GET /saves/:id` (detail.ts) respeta para no reofrecer la tarjeta tras recargar.
describe('POST /saves/:id/combat/dejar-vivir/:npcSlug con participantId (combate múltiple real, bug real 2026-08-29)', () => {
  let saveId: string;
  let encounterId: string;
  let objetivo: { id: string };
  let otro: { id: string };

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (dejar vivir grupo)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });

    const { encounterId: eid } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 10, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-dejar-vivir-grupo', destreza: 8, inteligencia: 4, esGrupo: true },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-dejar-vivir-grupo', destreza: 8, inteligencia: 4, esGrupo: true },
      ]),
    );
    encounterId = eid;
    [objetivo, otro] = await prisma.combatParticipant.findMany({ where: { encounterId, npcId: enemigo.id }, orderBy: { id: 'asc' } });
    await prisma.combatParticipant.update({ where: { id: objetivo.id }, data: { condicionFisicaGrupo: 'CONVALECIENTE' } });
  });

  afterAll(async () => {
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('marca dismissedGrupo SOLO en el participante indicado, nunca en el otro individuo del grupo', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/combat/dejar-vivir/aullador-rojo`,
      payload: { participantId: objetivo.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().participantId).toBe(objetivo.id);

    const objetivoFresco = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: objetivo.id } });
    const otroFresco = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: otro.id } });
    expect(objetivoFresco.dismissedGrupo).toBe(true);
    expect(objetivoFresco.condicionFisicaGrupo).toBe('CONVALECIENTE'); // Clemente no cambia la condición
    expect(otroFresco.dismissedGrupo).not.toBe(true);

    const logEntry = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
    expect(logEntry.text).toContain('deja con vida a');
  });

  it('400 si el mismo individuo ya se resolvió (no vuelve a aceptar Clemente sobre alguien ya dismissed)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/combat/dejar-vivir/aullador-rojo`,
      payload: { participantId: otro.id },
    });
    // El "otro" individuo sigue ILESO (nunca se le tocó la condición) — 400 por no estar
    // CONVALECIENTE, confirmando que no hay contaminación cruzada entre los dos participantes.
    expect(res.statusCode).toBe(400);
  });
});
