import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { sessionRoutes } from './session.js';
import { detailRoutes } from './detail.js';
import { iniciarCombatEncounter } from '../../services/combateMultipleOrquestacion.js';

async function buildAppWithDetail() {
  const app = Fastify();
  await app.register(sessionRoutes);
  await app.register(detailRoutes);
  return app;
}

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

    // Libro de Sucesos (CR-3): el perdón queda registrado, enlazado a su entrada del diario.
    const perdon = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'PERDON_CONCEDIDO' } });
    expect(perdon.logEntryId).toBe(logEntry.id);
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

// Aviso de misión pendiente (2026-09-15, hallazgo real jugando en vivo: "Acabar con el Orco
// Enfurecido" seguía ACTIVA sin ningún aviso tras elegir Clemente — decisión de 2026-08-31
// mantiene que solo la MUERTE real cierra "derrotar a X", pero nada avisaba de que el objetivo
// seguía vivo y la misión seguía completable). Save propio para no interferir con la secuencia del
// describe de arriba (mismos 3 tests corren sobre el MISMO saveId en orden).
describe('POST /saves/:id/combat/dejar-vivir/:npcSlug — aviso de misión pendiente (activeQuestTitlesTargeting)', () => {
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
        characterName: 'Gorhorn de prueba (aviso misión)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: location.id,
        pendingCombatNpcSlugs: [npcSlug],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
    await prisma.quest.create({
      data: { saveId, title: 'Acabar con el Orco Enfurecido', description: 'x', status: 'ACTIVA', targetNpcId: npcId },
    });
  });

  afterAll(async () => {
    await prisma.quest.deleteMany({ where: { saveId } });
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('Clemente sobre un NPC con misión ACTIVA de "derrotar a X" devuelve su título en misionesPendientes, sin cerrarla', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/${npcSlug}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().misionesPendientes).toEqual(['Acabar con el Orco Enfurecido']);

    const quest = await prisma.quest.findFirstOrThrow({ where: { saveId, title: 'Acabar con el Orco Enfurecido' } });
    expect(quest.status).toBe('ACTIVA'); // Clemente NO la cierra — decisión explícita de 2026-08-31.
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

  // Cobertura que faltaba, señalada en checklist-pruebas-juego.md ("BUG CERRADO 2026-08-29:
  // recargar tras Convaleciente atasca el combate del todo" — verificado con Playwright en su
  // momento, pero sin test de integración real de `GET /saves/:id`, a diferencia de
  // `esperandoDefensaJugador`, que sí lo tiene). Confirma en el mismo Postgres real que
  // `detail.ts` reconstruye `combateIniciado` de forma coherente con `dismissedGrupo`: el
  // participante ya resuelto (Clemente) desaparece de la tarjeta, el resto del grupo sin resolver
  // (incluido uno CONVALECIENTE) sigue apareciendo — la "recarga" real es justo esta llamada.
  it('GET /saves/:id tras "recargar": el participante dismissed desaparece de combateIniciado, el resto (incluido uno CONVALECIENTE) sigue', async () => {
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { slug: 'aullador-rojo' } });
    const resuelto = await prisma.combatParticipant.create({
      data: { encounterId, bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-dejar-vivir-grupo-getcheck', condicionFisicaGrupo: 'CONVALECIENTE' },
    });
    const pendienteConvaleciente = await prisma.combatParticipant.create({
      data: { encounterId, bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-dejar-vivir-grupo-getcheck', condicionFisicaGrupo: 'CONVALECIENTE' },
    });
    const app = await buildApp();
    const dejarVivirRes = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/combat/dejar-vivir/aullador-rojo`,
      payload: { participantId: resuelto.id },
    });
    expect(dejarVivirRes.statusCode).toBe(200);

    const appDetail = await buildAppWithDetail();
    const getRes = await appDetail.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(getRes.statusCode).toBe(200);
    const { combateIniciado } = getRes.json() as { combateIniciado: { npcs: { name: string; condicionFisica: string }[] } | null };

    expect(combateIniciado).not.toBeNull();
    const npcsRestantes = combateIniciado!.npcs;
    // El resuelto (Clemente) nunca vuelve a aparecer tras "recargar" — justo el bug real que
    // reabría la tarjeta MATAR/CLEMENTE sobre un individuo ya decidido.
    expect(npcsRestantes.length).toBeGreaterThan(0);
    expect(npcsRestantes.every((n) => n.condicionFisica !== undefined)).toBe(true);
    const conCondicionConvaleciente = npcsRestantes.filter((n) => n.condicionFisica === 'CONVALECIENTE');
    // El participante CONVALECIENTE sin resolver sigue en la tarjeta — la vía de salida real
    // (Matar/Capturar/Clemente) sigue disponible tras recargar, en vez de un atasco sin UI.
    expect(conCondicionConvaleciente.length).toBeGreaterThan(0);
  }, 20_000);
});

// Hallazgo 53 (revisar-partida-hallazgos.md, 2026-09-15): `/combat/dejar-vivir` y `/combat/matar`
// solo comprobaban `rejectIfEnded`, nunca `rejectIfPendingDeath` — una ventana real (aunque
// estrecha) entre "el motor ya decidió MUERTO" y "pendingCombatNpcSlugs todavía sin limpiar"
// dejaba a estas rutas operar sobre un combate que el jugador, narrativamente, ya no puede decidir
// (está muerto/inconsciente). Mismo patrón de test que
// `companeros.integration.test.ts § guard de save.pendingDeathResolution` — IDs inventados en la
// URL, el guard corta antes de buscar nada real.
describe('/combat/dejar-vivir y /combat/matar — guard de save.pendingDeathResolution (hallazgo 53, 2026-09-15)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (dejar-vivir/matar, muerte pendiente)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        pendingDeathResolution: true,
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('POST /combat/dejar-vivir/:npcSlug → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/npc-inexistente` });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).pendingDeathResolution).toBe(true);
  });

  it('POST /combat/matar/:npcSlug → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/matar/npc-inexistente` });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).pendingDeathResolution).toBe(true);
  });
});
