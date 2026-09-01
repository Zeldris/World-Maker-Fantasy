import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { advanceCompanionSurvival, advancePlayerSurvival, autoEquiparDesdeAlmacen, FELICIDAD_DESCUIDO_PASO, AGUA_MINUTOS_POR_TRAMO } from './companionSupervivencia.js';

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
