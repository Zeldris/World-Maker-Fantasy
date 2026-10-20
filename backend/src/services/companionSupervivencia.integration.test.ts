import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { deathRoutes } from '../routes/saves/death.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { advanceCompanionSurvival, advancePlayerSurvival, advanceCorpseAndRecoveryTimeouts, autoEquiparDesdeAlmacen, FELICIDAD_DESCUIDO_PASO, AGUA_MINUTOS_POR_TRAMO } from './companionSupervivencia.js';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-25): estas 3 funciones no tenían ningún
/// test — no es lógica trivial: `advanceCompanionSurvival`/`advancePlayerSurvival` corren en
/// producción cada tick de mundo real (`workers/worldTick.ts`), y `autoEquiparDesdeAlmacen` la
/// llaman 4 handlers de rutas reales (`routes/saves/companeros.ts`). Integración real contra
/// Postgres (todas reciben un `PrismaClient`/`Prisma.TransactionClient` real, no mockeable de forma
/// significativa).

// 4 tramos de AGUA_MINUTOS_POR_TRAMO = umbral exacto en el que porcentajeSupervivencia llega a 0%
// (por debajo de UMBRAL_DESCUIDO_PCT=25) — ver companionSupervivencia.ts § porcentajeSupervivencia.
const MINUTOS_HASTA_AGUA_VACIA = AGUA_MINUTOS_POR_TRAMO * 4;

describe('advanceCompanionSurvival', () => {
  let saveId: string;
  let companionDescuidadoId: string;
  let companionCuidadoId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (supervivencia de compañeros)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: MINUTOS_HASTA_AGUA_VACIA } });

    const descuidado = await prisma.companion.create({
      data: { saveId, name: 'Compañero descuidado', role: 'mascota', notes: '', tipo: 'FAUNA', felicidad: 50, lastWateredAtMinutes: 0, lastFedAtMinutes: 0 },
    });
    companionDescuidadoId = descuidado.id;
    const cuidado = await prisma.companion.create({
      data: { saveId, name: 'Compañero cuidado', role: 'mascota', notes: '', tipo: 'FAUNA', felicidad: 50, lastWateredAtMinutes: MINUTOS_HASTA_AGUA_VACIA, lastFedAtMinutes: MINUTOS_HASTA_AGUA_VACIA },
    });
    companionCuidadoId = cuidado.id;
  });

  afterAll(async () => {
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('descuida Felicidad del compañero con Agua por debajo del umbral, y no toca al que sigue bien atendido', async () => {
    const result = await advanceCompanionSurvival(prisma);
    expect(result.companionsAfectados).toBeGreaterThanOrEqual(1);

    const descuidado = await prisma.companion.findUniqueOrThrow({ where: { id: companionDescuidadoId } });
    expect(descuidado.felicidad).toBe(50 - FELICIDAD_DESCUIDO_PASO);

    const cuidado = await prisma.companion.findUniqueOrThrow({ where: { id: companionCuidadoId } });
    expect(cuidado.felicidad).toBe(50);
  });

  it('nunca baja Felicidad por debajo de 0', async () => {
    await prisma.companion.update({ where: { id: companionDescuidadoId }, data: { felicidad: 0 } });
    await advanceCompanionSurvival(prisma);
    const descuidado = await prisma.companion.findUniqueOrThrow({ where: { id: companionDescuidadoId } });
    expect(descuidado.felicidad).toBe(0);
  });
});

describe('advancePlayerSurvival', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (supervivencia del personaje)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        condicionFisica: 'ILESO',
        lastAteAtMinutes: 0,
        lastDrankAtMinutes: 0,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: MINUTOS_HASTA_AGUA_VACIA } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('empeora condicionFisica cuando Hambre/Sed llevan mucho descuidadas — nunca la mejora', async () => {
    const result = await advancePlayerSurvival(prisma);
    expect(result.savesAfectados).toBeGreaterThanOrEqual(1);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).not.toBe('ILESO');
  });
});

/// Cobertura nueva (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 5-bis punto 11, 2026-09-21) — mismo criterio
/// de integración real que `advancePlayerSurvival` de arriba: corre en producción cada tick de
/// mundo real (`workers/worldTick.ts`), coexistiendo a propósito con `applyCondicionTimeouts`
/// (turnResolution.ts, dentro del turno síncrono).
describe('advanceCorpseAndRecoveryTimeouts', () => {
  const RECOVERY_MIN = 6 * 60;
  const DESPAWN_MIN = 48 * 60;
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (timeouts de fondo)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: DESPAWN_MIN + 10 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('recupera un CONVALECIENTE a HERIDO tras 6h de ficción, sin que el jugador actúe', async () => {
    const state = await prisma.npcState.create({
      data: { saveId, npcId, scope: 'timeout-convaleciente', condicionFisica: 'CONVALECIENTE', condicionFisicaSinceMinutes: 0 },
    });
    const result = await advanceCorpseAndRecoveryTimeouts(prisma);
    expect(result.recovered).toBeGreaterThanOrEqual(1);
    const after = await prisma.npcState.findUniqueOrThrow({ where: { id: state.id } });
    expect(after.condicionFisica).toBe('HERIDO');
  });

  it('borra el NpcState de un cadáver MUERTO tras 48h de ficción, sin que el jugador actúe', async () => {
    const state = await prisma.npcState.create({
      data: { saveId, npcId, scope: 'timeout-muerto', condicionFisica: 'MUERTO', condicionFisicaSinceMinutes: 0 },
    });
    const result = await advanceCorpseAndRecoveryTimeouts(prisma);
    expect(result.despawned).toBeGreaterThanOrEqual(1);
    const after = await prisma.npcState.findUnique({ where: { id: state.id } });
    expect(after).toBeNull();
  });

  it('nunca toca un NpcState que todavía no cumplió su plazo', async () => {
    const state = await prisma.npcState.create({
      data: { saveId, npcId, scope: 'timeout-reciente', condicionFisica: 'CONVALECIENTE', condicionFisicaSinceMinutes: DESPAWN_MIN + 5 },
    });
    await advanceCorpseAndRecoveryTimeouts(prisma);
    const after = await prisma.npcState.findUniqueOrThrow({ where: { id: state.id } });
    expect(after.condicionFisica).toBe('CONVALECIENTE');
  });
});

describe('autoEquiparDesdeAlmacen', () => {
  let saveId: string;
  let companionId: string;
  let almacenItemId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (auto-equipo de Almacén)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;

    const plantilla = await prisma.plantillaEquipo.create({
      data: { saveId, name: 'Guardia con arma', rol: 'guardia', slots: { ARMA_PRINCIPAL: { category: 'arma' } }, prioridad: 0 },
    });
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Súbdito armado', role: 'guardia', notes: '', tipo: 'NPC', plantillaEquipoId: plantilla.id },
    });
    companionId = companion.id;
    const almacenItem = await prisma.almacenItem.create({
      data: { saveId, name: 'Cuchillo de hielo sílice', description: 'x', catalogSlug: 'cuchillo-hielo-silice' },
    });
    almacenItemId = almacenItem.id;
  });

  afterAll(async () => {
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.almacenItem.deleteMany({ where: { saveId } });
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.plantillaEquipo.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('mueve un objeto real del Almacén al compañero cuyo hueco de plantilla coincide por categoría', async () => {
    const result = await prisma.$transaction((tx) => autoEquiparDesdeAlmacen(tx, saveId));
    expect(result.equipados).toBe(1);

    const equipped = await prisma.inventoryItem.findFirst({ where: { companionId, slot: 'ARMA_PRINCIPAL' } });
    expect(equipped).toMatchObject({ catalogSlug: 'cuchillo-hielo-silice', name: 'Cuchillo de hielo sílice' });

    const almacenAfter = await prisma.almacenItem.findUnique({ where: { id: almacenItemId } });
    expect(almacenAfter).toBeNull();
  });

  it('no hace nada si ya no queda ningún objeto en el Almacén que encaje (segunda pasada, idempotente)', async () => {
    const result = await prisma.$transaction((tx) => autoEquiparDesdeAlmacen(tx, saveId));
    expect(result.equipados).toBe(0);
  });
});

// Deuda técnica cerrada (auditoría 2026-09-15): antes el Almacén se releía completo (query nueva)
// por cada slot vacío — con 2+ owners que necesitan el MISMO tipo de hueco, cada consulta veía el
// Almacén ya sin el objeto que el owner anterior acababa de consumir (el `delete` real ya había
// pasado). Tras cargar una sola vez y filtrar en memoria (`usados`), el comportamiento observable
// tiene que seguir siendo idéntico: cada objeto del Almacén se asigna como mucho a un owner, nunca
// dos veces, y con 2 objetos disponibles para 2 owners ambos deben quedar equipados.
describe('autoEquiparDesdeAlmacen — 2 owners compitiendo por el mismo tipo de hueco (deuda técnica, 2026-09-15)', () => {
  let saveId: string;
  let companionAId: string;
  let companionBId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (auto-equipo, 2 owners)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;

    const plantilla = await prisma.plantillaEquipo.create({
      data: { saveId, name: 'Guardia con arma (2 owners)', rol: 'guardia', slots: { ARMA_PRINCIPAL: { category: 'arma' } }, prioridad: 0 },
    });
    const [companionA, companionB] = await Promise.all([
      prisma.companion.create({ data: { saveId, name: 'Súbdito A', role: 'guardia', notes: '', tipo: 'NPC', plantillaEquipoId: plantilla.id } }),
      prisma.companion.create({ data: { saveId, name: 'Súbdito B', role: 'guardia', notes: '', tipo: 'NPC', plantillaEquipoId: plantilla.id } }),
    ]);
    companionAId = companionA.id;
    companionBId = companionB.id;
    await Promise.all([
      prisma.almacenItem.create({ data: { saveId, name: 'Cuchillo de hielo sílice', description: 'x', catalogSlug: 'cuchillo-hielo-silice' } }),
      prisma.almacenItem.create({ data: { saveId, name: 'Maza orca', description: 'x', catalogSlug: 'maza-orca' } }),
    ]);
  });

  afterAll(async () => {
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.almacenItem.deleteMany({ where: { saveId } });
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.plantillaEquipo.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('con 2 objetos disponibles para 2 owners con el mismo hueco: ambos quedan equipados, nunca el mismo objeto dos veces', async () => {
    const result = await prisma.$transaction((tx) => autoEquiparDesdeAlmacen(tx, saveId));
    expect(result.equipados).toBe(2);

    const [equippedA, equippedB] = await Promise.all([
      prisma.inventoryItem.findFirst({ where: { companionId: companionAId, slot: 'ARMA_PRINCIPAL' } }),
      prisma.inventoryItem.findFirst({ where: { companionId: companionBId, slot: 'ARMA_PRINCIPAL' } }),
    ]);
    expect(equippedA).not.toBeNull();
    expect(equippedB).not.toBeNull();
    // Nunca el mismo objeto real asignado a los dos.
    expect(equippedA!.catalogSlug).not.toBe(equippedB!.catalogSlug);

    const almacenRestante = await prisma.almacenItem.count({ where: { saveId } });
    expect(almacenRestante).toBe(0);
  });
});

describe('P219: aviso de carencia y reaparición', () => {
  let saveId: string;
  const AHORA = MINUTOS_HASTA_AGUA_VACIA * 3;
  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: 'Gorhorn de prueba (P219)', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
        condicionFisica: 'ILESO', lastAteAtMinutes: 0, lastDrankAtMinutes: 0, pendingDeathResolution: true, tutorialCompletedAt: new Date(),
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: AHORA } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el barrido deja un aviso en el diario al empeorar la condición', async () => {
    await advancePlayerSurvival(prisma);
    const avisos = await prisma.logEntry.findMany({ where: { saveId, isSystemMessage: true } });
    expect(avisos.length).toBe(1);
    expect(avisos[0].text).toMatch(/hambre|sed/);
  });

  it('al reaparecer, Hambre y Sed quedan al 100 % y el barrido ya no baja la condición', async () => {
    const app = Fastify();
    await app.register(deathRoutes);
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/death/resolve` });
    expect(res.statusCode).toBe(200);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).toBe('ILESO');
    expect(save.lastAteAtMinutes).toBe(AHORA);
    expect(save.lastDrankAtMinutes).toBe(AHORA);
    await advancePlayerSurvival(prisma);
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).condicionFisica).toBe('ILESO');
    await app.close();
  });
});
