import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';

/// B29 (2026-09-29, pruebas en vivo 2026-09-28) — "Ataco al Gesgurio" con la fauna adyacente daba
/// una tirada y nada más. Ahora `/turn/classify` resuelve el ataque de texto libre contra una fauna
/// nombrada con `ZonePoint` de ESTA partida en la celda del jugador o adyacente igual que "Cazar" en
/// la tarjeta (`iniciarCaza`). Postgres real; solo se mockea la frontera del LLM (clasificador).
const classifyAction = vi.fn();
vi.mock('../services/narrador.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/narrador.js')>();
  return { ...actual, classifyAction: (...args: unknown[]) => classifyAction(...args) };
});

const { turnRoutes } = await import('./turn.js');

async function buildApp() {
  const app = Fastify();
  await app.register(turnRoutes);
  return app;
}

describe('B29 — atacar por texto a fauna adyacente (/turn/classify)', () => {
  let saveId: string;
  let worldId: string;
  let locationId: string;
  const npcIds: string[] = [];

  async function crearFauna(slug: string, name: string, level: number, capturablePct: number) {
    const npc = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug,
        name,
        aliases: [name.toLowerCase()],
        role: 'Fauna de prueba',
        level,
        capturablePct,
        attributes: { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 2, voluntad: 2, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'CAUTELOSO',
      },
    });
    npcIds.push(npc.id);
  }

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const location = await prisma.location.create({
      data: { worldId, slug: 'test-b29-caza-texto', name: 'Zona de Prueba B29', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba b29'] },
    });
    locationId = location.id;
    // Jugador nivel 5: débil = nivel <= 3.
    await crearFauna('test-b29-debil', 'Corrolanto Débil', 1, 80);
    await crearFauna('test-b29-fuerte', 'Corrolanto Fuerte', 5, 30);
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba B29',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        level: 5,
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
        zonaPosX: 425,
        zonaPosY: 325, // celda (8,6); un punto en (475,325) queda ADYACENTE, uno en (725,325) lejos
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
    classifyAction.mockResolvedValue({ requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0 });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    for (const id of npcIds) await prisma.npc.delete({ where: { id } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    classifyAction.mockClear();
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: Prisma.JsonNull, pendingCombatNpcSlugs: [] } });
  });

  async function punto(slug: string, x: number, y: number) {
    return prisma.zonePoint.create({ data: { locationId, saveId, x, y, tipo: 'FAUNA', targetSlug: slug, cantidad: 1, activo: true, lastUpdatedAtMinutes: 480 } });
  }

  async function classify(action: string) {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    expect(res.statusCode).toBe(200);
    return res.json();
  }

  it('presa débil adyacente: "Ataco al X" resuelve la caza limpia (sin narrador), persiste la acción y descuenta el ZonePoint', async () => {
    const p = await punto('test-b29-debil', 475, 325);
    vi.spyOn(Math, 'random').mockReturnValue(0); // d100 = 1: éxito seguro
    const body = await classify('Ataco al Corrolanto Débil.');
    expect(body.cazaPorTexto).toMatchObject({ resuelveSinCombate: true, exito: true });
    expect(body.cazaPorTexto.logEntry.roll).toMatchObject({ kind: 'caza-sigilo', exito: true });
    expect(classifyAction).not.toHaveBeenCalled();
    const accion = await prisma.logEntry.findFirst({ where: { saveId, isPlayerAction: true } });
    expect(accion?.text).toBe('Ataco al Corrolanto Débil.');
    // Un punto sin ancla se borra al llegar a 0 individuos (descontarZonePointCaza).
    const trasCaza = await prisma.zonePoint.findUnique({ where: { id: p.id } });
    expect(trasCaza === null || trasCaza.cantidad === 0).toBe(true);
  });

  it('presa no débil en la MISMA celda: devuelve el actionText de la caza para mandarlo por el turno normal', async () => {
    await punto('test-b29-fuerte', 425, 325);
    const body = await classify('Ataco al Corrolanto Fuerte.');
    expect(body.cazaPorTexto.resuelveSinCombate).toBe(false);
    expect(body.cazaPorTexto.actionText).toContain("'Corrolanto Fuerte'");
    expect(classifyAction).not.toHaveBeenCalled();
  });

  it('el actionText que devuelve la propia caza NO se vuelve a interceptar (sin bucle)', async () => {
    await punto('test-b29-fuerte', 425, 325);
    const body = await classify("Salgo a cazar y ataco a 'Corrolanto Fuerte'.");
    expect(body.cazaPorTexto).toBeUndefined();
    expect(body.classification).toBeDefined();
  });

  it('fauna nombrada pero LEJOS (celda no adyacente): comportamiento de siempre, sin cazaPorTexto', async () => {
    await punto('test-b29-debil', 725, 325);
    const body = await classify('Ataco al Corrolanto Débil.');
    expect(body.cazaPorTexto).toBeUndefined();
  });

  it('un ZonePoint de OTRA partida no cuenta (los puntos son por partida)', async () => {
    const userId = await getDefaultUserId();
    const otra = await prisma.save.create({
      data: { userId, worldId, characterName: 'Otra B29', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor', characterMotivation: 'x', level: 5, attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'O', currentLocationId: locationId },
    });
    try {
      await prisma.zonePoint.create({ data: { locationId, saveId: otra.id, x: 475, y: 325, tipo: 'FAUNA', targetSlug: 'test-b29-debil', cantidad: 1, activo: true, lastUpdatedAtMinutes: 480 } });
      const body = await classify('Ataco al Corrolanto Débil.');
      expect(body.cazaPorTexto).toBeUndefined();
    } finally {
      await prisma.zonePoint.deleteMany({ where: { saveId: otra.id } });
      await prisma.save.delete({ where: { id: otra.id } });
    }
  });

  it('texto sin intención de ataque ("Observo al X") con la fauna adyacente: no caza', async () => {
    await punto('test-b29-debil', 475, 325);
    const body = await classify('Observo al Corrolanto Débil con calma.');
    expect(body.cazaPorTexto).toBeUndefined();
  });
});
