import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { asegurarMundoDePartida } from '../../services/mundoPartida.js';
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
    // Fase 10 (2026-09-29, "todas las tiradas visibles") — la tirada de Explorar viaja en la respuesta
    // (misma forma que GET /recolectar/:oficio), también cuando el intento falla.
    expect(body.roll).toMatchObject({ attribute: expect.any(String), value: expect.any(Number), advantage: expect.any(Boolean) });
    expect(Array.isArray(body.roll.rolls)).toBe(true);
    expect(body.roll.rolls).toContain(body.roll.usedRoll);
    expect(body.roll.result).toBe(body.roll.usedRoll + Math.floor(body.roll.value / 2) + body.roll.bonusOficio);

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
      // La tirada persiste en `LogEntry.roll` (sobrevive a una recarga).
      expect(body.logEntry.roll).toMatchObject({ kind: 'recoleccion', tirada: body.roll });
      expect(nuevaEntrada.roll).toMatchObject({ kind: 'recoleccion', tirada: body.roll });
    } else {
      // F9-4: el fallo también persiste su tirada como LogEntry de sistema (antes solo se veía en vivo).
      expect(logCountDespues).toBe(logCountAntes + 1);
      const entradaFallo = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
      expect(entradaFallo.isSystemMessage).toBe(true);
      expect(entradaFallo.text).toBe(body.narration);
      expect(entradaFallo.roll).toMatchObject({ kind: 'recoleccion', tirada: body.roll });
      expect(body.logEntry.id).toBe(entradaFallo.id);
    }
  });

  // F9-4 (2026-09-29): el fallo (dado bajo) también deja LogEntry de sistema con la tirada.
  it('tirada fallida: persiste un LogEntry de sistema con la tirada (kind recoleccion) y limpia la oferta', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: { tipo: 'RECURSO', targetSlug: 'yerreo', targetName: 'Yerreo' } } });
    const antes = await prisma.logEntry.count({ where: { saveId } });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // todos los dados al mínimo
    try {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/yerreo` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.exito).toBe(false);
      expect(await prisma.logEntry.count({ where: { saveId } })).toBe(antes + 1);
      const entrada = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
      expect(entrada.isSystemMessage).toBe(true);
      expect(entrada.text).toBe(body.narration);
      expect(entrada.roll).toMatchObject({ kind: 'recoleccion', tirada: body.roll });
      expect(body.logEntry.id).toBe(entrada.id);
      expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).pendingDynamicModeOffer).toBeNull();
    } finally {
      spy.mockRestore();
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
    // CR-6 (hito 0.2): se agota la población de ESTA partida (su copia del catálogo).
    await asegurarMundoDePartida(prisma, saveId);
    const poblacionReal = await prisma.worldPopulation.findFirstOrThrow({
      where: { saveId, targetType: 'RECURSO', targetSlug: 'yerreo' },
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

  // P109 (QA-27): raspar quitina tira por Destreza y el «×N» del punto baja con lo que se lleva.
  it('Pared de arcilla: tirada de Destreza y el punto del mapa pierde lo recolectado', async () => {
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 260, y: 340, tipo: 'RECURSO', targetSlug: 'pared-arcilla-gesgurio', cantidad: 20, activo: true, lastUpdatedAtMinutes: 480 },
    });
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: { tipo: 'RECURSO', targetSlug: 'pared-arcilla-gesgurio', targetName: 'Pared de arcilla' } } });
    const azar = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/pared-arcilla-gesgurio` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.roll.attribute).toBe('destreza');
      expect(body.exito).toBe(true);
      const despues = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
      expect(despues.cantidad).toBeLessThan(20);
    } finally {
      azar.mockRestore();
      await prisma.zonePoint.delete({ where: { id: punto.id } });
    }
  });

  // P173 (QA-27): «Recoger» (PASIVO) daba la leche y el recinto seguía en ×20: solo minar/talar/extraer
  // bajaba el punto.
  it('Recoger leche del recinto: el punto del mapa pierde lo recogido', async () => {
    const colmillo = await prisma.location.findFirstOrThrow({ where: { slug: 'campamento-serhu', world: { slug: 'helek-sirik' } } });
    const antes = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { currentLocationId: true } });
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: colmillo.id, pendingDynamicModeOffer: { tipo: 'RECURSO', targetSlug: 'murgoles-domados-campamento', targetName: 'Recinto de múrgoles domados' } } });
    const punto = await prisma.zonePoint.create({
      data: { locationId: colmillo.id, saveId, x: 400, y: 460, tipo: 'RECURSO', targetSlug: 'murgoles-domados-campamento', cantidad: 20, activo: true, lastUpdatedAtMinutes: 480 },
    });
    const azar = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/murgoles-domados-campamento` });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).exito).toBe(true);
      expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } })).cantidad).toBeLessThan(20);
    } finally {
      azar.mockRestore();
      await prisma.zonePoint.delete({ where: { id: punto.id } });
      await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: antes.currentLocationId } });
    }
  });

  // `/code-review` del PR #53: con dos puntos de la misma fuente, baja el que se está recolectando
  // (el de la oferta), no el que más tiene.
  it('dos puntos de la misma fuente: baja el de la oferta, no el más grande', async () => {
    // La prueba anterior acaba de recolectar esta fuente: sin esto, el enfriamiento la deja sin nada.
    await prisma.worldPopulation.updateMany({ where: { targetSlug: 'pared-arcilla-gesgurio', OR: [{ saveId }, { saveId: null }] }, data: { lastHarvestedAt: null } });
    const grande = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 100, y: 100, tipo: 'RECURSO', targetSlug: 'pared-arcilla-gesgurio', cantidad: 20, activo: true, lastUpdatedAtMinutes: 480 },
    });
    const elegido = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 260, y: 340, tipo: 'RECURSO', targetSlug: 'pared-arcilla-gesgurio', cantidad: 12, activo: true, lastUpdatedAtMinutes: 480 },
    });
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'RECURSO', targetSlug: 'pared-arcilla-gesgurio', targetName: 'Pared de arcilla', zonePointId: elegido.id } },
    });
    const azar = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/pared-arcilla-gesgurio` });
      expect(JSON.parse(res.body).exito).toBe(true);
      expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: elegido.id } })).cantidad).toBeLessThan(12);
      expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: grande.id } })).cantidad).toBe(20);
    } finally {
      azar.mockRestore();
      await prisma.zonePoint.deleteMany({ where: { id: { in: [grande.id, elegido.id] } } });
    }
  });
});

/// Fase 6 (plan Oct 2026): las fuentes de PESCA y BUSQUEDA (fauna acuática, `sourceCategory: 'fauna'`)
/// también se resuelven desde el mapa vía Interactuar → `resolverRecoleccion`. Mismo harness real
/// (Postgres, catálogo sembrado) en Playa de Ceniza Blanca, donde el catálogo las sitúa.
describe('POST /saves/:id/modo-dinamico/recurso/:targetSlug — PESCA y BUSQUEDA', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'playa-de-ceniza-blanca' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (pesca)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 15, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  for (const [slug, nombre, habilidad] of [
    ['jashil-rojo', 'Jashil Rojo', 'Pescar'],
    ['rugoconcha', 'Rugoconcha', 'Buscar'],
  ] as const) {
    it(`${slug}: la interacción se resuelve (200 con habilidad ${habilidad}) y limpia la oferta pendiente`, async () => {
      await prisma.save.update({
        where: { id: saveId },
        data: { pendingDynamicModeOffer: { tipo: 'RECURSO', targetSlug: slug, targetName: nombre } },
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/${slug}` });
      expect(res.statusCode, res.body).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.narration.length).toBeGreaterThan(0);
      if (body.exito) expect(body.abilityName).toBe(habilidad);
      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingDynamicModeOffer).toBeNull();
    });
  }
});

/// P136 (QA-27): la leche de los múrgoles domados se recoge sin tirada (antes «Recoger» tiraba Destreza).
describe('POST /saves/:id/modo-dinamico/recurso/:targetSlug — recoger sin tirada', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'campamento-serhu', saveId: null } });
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: 'Gorhorn de prueba (múrgoles)', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor',
        characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G', currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('múrgoles domados: sin dado y con la leche en el inventario', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: { tipo: 'RECURSO', targetSlug: 'murgoles-domados-campamento', targetName: 'Múrgoles domados' } } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/recurso/murgoles-domados-campamento` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.roll).toBeUndefined();
    expect(body.exito).toBe(true);
    expect([...(body.items ?? []), ...(body.updatedItems ?? [])].some((i: { name: string }) => /leche/i.test(i.name))).toBe(true);
  });
});
