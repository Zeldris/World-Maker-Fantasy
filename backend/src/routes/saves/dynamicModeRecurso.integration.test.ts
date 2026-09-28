import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// "Interactuar" sobre RECURSO (2026-09-08, "Ver qué hay en la zona") — harness de integración real
/// (Postgres real, catálogo ya sembrado, sin mocks) contra `yerreo` en La Hondonada del Eco (tier 4,
/// worldCatalog.ts): confirma el ciclo completo tirada real → recolección real → LogEntry real,
/// reutilizando exactamente las mismas reglas de `/recolectar/confirmar` (resolverRecoleccion).
const { dynamicModeRecursoRoutes } = await import('./dynamicModeRecurso.js');

async function buildApp() {
  const app = Fastify();
  await app.register(dynamicModeRecursoRoutes);
  return app;
}

describe('POST /saves/:id/modo-dinamico/recurso/:targetSlug', () => {
  let saveId: string;
  let locationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    locationId = location.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (recurso)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 15, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
    // Nivel 5 de minero (yerreo es tier 4, worldCatalog.ts) — suficiente para que
    // `pasaFiltroNivelOficio` lo deje pasar como candidato real.
    await prisma.professionProgress.create({ data: { saveId, professionId: 'minero-llanuras', nivel: 5 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('recolecta yerreo de una sentada: tirada real + LogEntry real + limpia la oferta pendiente', async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'RECURSO', targetSlug: 'yerreo', targetName: 'Yerreo' } },
    });
    const logCountAntes = await prisma.logEntry.count({ where: { saveId } });

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/yerreo` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(typeof body.narration).toBe('string');
    expect(body.narration.length).toBeGreaterThan(0);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicModeOffer).toBeNull();

    // No se puede asegurar éxito determinista (la tirada es real), pero si hubo éxito, debe haber
    // dejado exactamente un LogEntry nuevo con el texto ya determinista de resolverRecoleccion.
    const logCountDespues = await prisma.logEntry.count({ where: { saveId } });
    if (body.exito) {
      expect(logCountDespues).toBe(logCountAntes + 1);
      expect(body.abilityName).toBe('Minar');
      const nuevaEntrada = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
      expect(nuevaEntrada.text).toContain('Gorhorn de prueba (recurso)');
    } else {
      expect(logCountDespues).toBe(logCountAntes);
    }
  });

  // Bug real jugando en vivo (2026-09-28): un minero de nivel 1 frente al Yerreo (tier 4) recibía
  // "puede que se te haya adelantado, o esté fuera de temporada" — ninguna de las dos cosas. Ahora
  // el 400 dice el motivo real (nivel de oficio) y sigue limpiando la oferta.
  it('nivel de oficio insuficiente para el tier del recurso: 400 con el motivo real y limpia la oferta', async () => {
    await prisma.professionProgress.updateMany({ where: { saveId, professionId: 'minero-llanuras' }, data: { nivel: 1 } });
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'RECURSO', targetSlug: 'yerreo', targetName: 'Yerreo' } },
    });
    try {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/yerreo` });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/Minar a nivel 4 \(tienes nivel 1\)/);
      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingDynamicModeOffer).toBeNull();
    } finally {
      await prisma.professionProgress.updateMany({ where: { saveId, professionId: 'minero-llanuras' }, data: { nivel: 5 } });
    }
  });

  it('recurso inexistente en el catálogo: 400', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/no-existe-de-verdad` });
    expect(res.statusCode).toBe(400);
  });

  it('recurso real pero fuera de la Location actual (candado de región): 400', async () => {
    // Mover al personaje a una Location sin relación con yerreo (candado a hondonada-del-eco).
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: null } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/yerreo` });
    expect(res.statusCode).toBe(400);
    // Restaurar para no afectar otros tests del mismo describe si el orden cambiara.
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: locationId } });
  });

  // Bug real encontrado jugando la batería de reinicio (2026-09-20): "candidato no disponible ahora
  // mismo" (población regional agotada, fuera de temporada/clima...) devolvía 400 sin limpiar
  // `pendingDynamicModeOffer` — la oferta atascada bloqueaba para siempre cualquier colisión/oferta
  // pacífica nueva (el guard de `detectarEncuentroEnCelda`, zona.ts, nunca ofrece nada mientras
  // exista una oferta pendiente), dejando al jugador sin forma de seguir jugando salvo reiniciar
  // sesión.
  it('candidato ya no disponible (población regional agotada): limpia la oferta pendiente igualmente', async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'RECURSO', targetSlug: 'yerreo', targetName: 'Yerreo' } },
    });
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const poblacionReal = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId: world.id, targetType: 'RECURSO', targetSlug: 'yerreo' },
    });
    // Población a 0: `candidateSourcesFor` filtra por `poblacion: { gt: 0 }` — sin ninguna fila con
    // población real, yerreo deja de ser candidato aunque el resto de condiciones (región/terreno/
    // temporada/nivel) sigan cumpliéndose, mismo caso real que "se te ha adelantado" en producción.
    await prisma.worldPopulation.update({ where: { id: poblacionReal.id }, data: { poblacion: 0 } });

    try {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/yerreo` });
      expect(res.statusCode).toBe(400);

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingDynamicModeOffer).toBeNull();
    } finally {
      // Restaurar la población real para no afectar otros tests/partidas que dependan del catálogo.
      await prisma.worldPopulation.update({ where: { id: poblacionReal.id }, data: { poblacion: poblacionReal.poblacion } });
    }
  });
});
