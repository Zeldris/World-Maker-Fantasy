import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { logRoutes } from './log.js';

/// Diario en pestañas jerárquicas Año → Estación → Día (2026-09-04) — GET /saves/:id/diario ahora
/// añade year/estacion/diaRelativo a cada LogEntry (calendarioFor, worldClock.ts) y fusiona los
/// capítulos (SessionSummary) que ya tienen fictionalMinutes real, dejando los legado sin fecha en
/// unplacedChapters. Mismo patrón de setup que entrega.integration.test.ts: app aislado solo con
/// logRoutes.
async function buildApp() {
  const app = Fastify();
  await app.register(logRoutes);
  return app;
}

describe('GET /saves/:id/diario — calendario y fusión de capítulos (2026-09-04)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (diario)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });

    // Día 1 (fictionalMinutes=0) → Año 1, Primavera, Día relativo 1.
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: 'Primer turno de la partida.', isPlayerAction: true, timeLabel: 'Día 1, mañana', fictionalMinutes: 0 },
    });
    // Día 131 (fictionalMinutes=1440*130) → Año 2, Primavera, Día relativo 11.
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: 'Turno mucho más tarde.', isPlayerAction: true, timeLabel: 'Día 131, mañana', fictionalMinutes: 1440 * 130 },
    });
    // Capítulo con fecha real (mismo día que el primer turno) — debe intercalarse en Año 1/Primavera/Día 1.
    await prisma.sessionSummary.create({ data: { saveId, chapterNumber: 1, summary: 'Resumen fechado del capítulo 1.', fictionalMinutes: 0 } });
    // Capítulo legado sin fecha — debe caer en unplacedChapters, no forzarse a ningún día.
    await prisma.sessionSummary.create({ data: { saveId, chapterNumber: 2, summary: 'Resumen legado sin fecha.', fictionalMinutes: null } });
  });

  afterAll(async () => {
    await prisma.sessionSummary.deleteMany({ where: { saveId } });
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('entradas traen year/estacion/diaRelativo coherentes con su fictionalMinutes', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/diario` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      entries: { kind: string; year: number; estacion: string; diaRelativo: number; day?: number; chapterNumber?: number }[];
      unplacedChapters: { chapterNumber: number; summary: string }[];
    };

    const primerTurno = body.entries.find((e) => e.kind === 'entry' && e.day === 1);
    expect(primerTurno).toMatchObject({ year: 1, estacion: 'PRIMAVERA', diaRelativo: 1 });

    const turnoTardio = body.entries.find((e) => e.kind === 'entry' && e.day === 131);
    expect(turnoTardio).toMatchObject({ year: 2, estacion: 'PRIMAVERA', diaRelativo: 11 });
  });

  it('el capítulo con fictionalMinutes real se intercala en entries con kind:"chapter", ubicado en su día', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/diario` });
    const body = res.json() as { entries: { kind: string; chapterNumber?: number; year?: number; estacion?: string; diaRelativo?: number }[] };

    const capituloFechado = body.entries.find((e) => e.kind === 'chapter' && e.chapterNumber === 1);
    expect(capituloFechado).toMatchObject({ year: 1, estacion: 'PRIMAVERA', diaRelativo: 1 });
  });

  it('el capítulo sin fictionalMinutes cae en unplacedChapters, no se le inventa una fecha', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/diario` });
    const body = res.json() as { entries: { chapterNumber?: number }[]; unplacedChapters: { chapterNumber: number; summary: string }[] };

    expect(body.unplacedChapters).toEqual([{ chapterNumber: 2, summary: 'Resumen legado sin fecha.' }]);
    expect(body.entries.some((e) => e.chapterNumber === 2)).toBe(false);
  });
});
