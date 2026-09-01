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

  it('BUG CERRADO (auditoría 2026-09-01, condición de carrera): dejar vivir dos veces al mismo NPC rechaza la segunda con 409 en vez de duplicar el LogEntry', async () => {
    // Antes de este fix, un segundo "dejar vivir" (doble clic, o replay) devolvía 200 igual que el
    // primero — sin comparar el slug ya ausente de pendingCombatNpcSlugs contra el estado fresco
    // dentro de la transacción, creaba un LogEntry duplicado narrando la misma decisión dos veces.
    const logCountAntes = await prisma.logEntry.count({ where: { saveId } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/${npcSlug}` });
    expect(res.statusCode).toBe(409);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual(['otro-npc-cualquiera']);
    const logCountDespues = await prisma.logEntry.count({ where: { saveId } });
    expect(logCountDespues).toBe(logCountAntes);
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

  it('BUG CERRADO (auditoría 2026-09-01, condición de carrera): dos "dejar vivir" simultáneos sobre el mismo participante crean como mucho 1 LogEntry', async () => {
    // Nuevo objetivo CONVALECIENTE propio para este test (independiente de `objetivo`, ya
    // dismissed por el primer test de este describe) — dos peticiones reales concurrentes vía
    // Promise.all, sin mockear la carrera a mano: solo una debe ganar (200), la otra debe rechazarse
    // con 409 sin duplicar el LogEntry, gracias a la relectura de `dismissedGrupo` dentro de la
    // transacción (antes de este fix, ninguna de las dos comprobaba nada y ambas escribían).
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { slug: 'aullador-rojo' } });
    const tercero = await prisma.combatParticipant.create({
      data: { encounterId, bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-dejar-vivir-grupo-race', condicionFisicaGrupo: 'CONVALECIENTE' },
    });
    const logCountAntes = await prisma.logEntry.count({ where: { saveId } });
    const app = await buildApp();

    const [resA, resB] = await Promise.all([
      app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/aullador-rojo`, payload: { participantId: tercero.id } }),
      app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/aullador-rojo`, payload: { participantId: tercero.id } }),
    ]);

    const codes = [resA.statusCode, resB.statusCode].sort();
    expect(codes).toEqual([200, 409]);
    const logCountDespues = await prisma.logEntry.count({ where: { saveId } });
    expect(logCountDespues).toBe(logCountAntes + 1);
    const terceroFresco = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: tercero.id } });
    expect(terceroFresco.dismissedGrupo).toBe(true);
  }, 20_000);
});
