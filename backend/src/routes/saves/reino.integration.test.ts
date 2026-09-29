import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { reinoRoutes } from './reino.js';
import { buildAdjacency, shortestPath } from '../../services/travel.js';

/// Zona-interior navegable propia del reino (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) —
/// primera vez que el motor crea una `Location` en TIEMPO DE PARTIDA (hasta ahora, 100% catálogo
/// sembrado a mano). Test de integración real contra Postgres, sin mocks — verifica que la fila
/// se crea de verdad, con el slug determinista correcto, y que es NAVEGABLE (LocationLink real,
/// resoluble por `shortestPath`, mismo motor de viaje que usa cualquier otro tramo del mundo).
const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

async function buildApp() {
  const app = Fastify();
  await app.register(reinoRoutes);
  return app;
}

describe('POST /saves/:id/reino/fundar — Location-interior dinámica (2026-09-21)', () => {
  let saveId: string;
  let worldId: string;
  let hondonadaId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (zona interior reino)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonadaId,
        raza: 'orcos',
      },
    });
    saveId = save.id;
    await prisma.building.create({
      data: { saveId, locationId: hondonadaId, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
  });

  afterAll(async () => {
    await prisma.locationLink.deleteMany({ where: { OR: [{ from: { slug: `ayuntamiento-interior-${saveId}` } }, { to: { slug: `ayuntamiento-interior-${saveId}` } }] } });
    await prisma.location.deleteMany({ where: { worldId, slug: `ayuntamiento-interior-${saveId}` } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('crea una Location real con slug determinista, region heredada del Ayuntamiento, y es navegable desde su exterior', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/fundar`,
      payload: { kingdomName: 'Reino de Prueba' },
    });
    expect(res.statusCode).toBe(200);

    const kingdomLocation = await prisma.location.findUnique({
      where: { worldId_slug: { worldId, slug: `ayuntamiento-interior-${saveId}` } },
    });
    expect(kingdomLocation).not.toBeNull();
    expect(kingdomLocation!.kind).toBe('interior');
    expect(kingdomLocation!.region).toBe('Las Llanuras del Viento Rojo'); // heredada de hondonada-del-eco
    expect(kingdomLocation!.name).toContain('Reino de Prueba');
    // Sin x/y propias a propósito — vive "dentro" de las coordenadas del exterior.
    expect(kingdomLocation!.x).toBeNull();
    expect(kingdomLocation!.y).toBeNull();

    // Navegable de verdad: un solo LocationLink basta (buildAdjacency ya lo trata bidireccional,
    // mismo motor de viaje real que cualquier otro tramo del mundo).
    const link = await prisma.locationLink.findFirst({ where: { fromId: hondonadaId, toId: kingdomLocation!.id } });
    expect(link).not.toBeNull();
    expect(link!.minutosBase).toBe(0);

    const links = await prisma.locationLink.findMany({ where: { from: { worldId } }, select: { fromId: true, toId: true, minutosBase: true, terreno: true, riesgo: true } });
    const path = shortestPath(buildAdjacency(links), hondonadaId, kingdomLocation!.id);
    expect(path).not.toBeNull();
    expect(path!.totalMinutos).toBe(0);
    const pathBack = shortestPath(buildAdjacency(links), kingdomLocation!.id, hondonadaId);
    expect(pathBack).not.toBeNull(); // navegable también de vuelta, sin fila explícita en ese sentido
  });

  it('el slug es determinista por save.id — no choca con otra partida ni con el catálogo de facción NPC', async () => {
    const kingdomLocation = await prisma.location.findUnique({
      where: { worldId_slug: { worldId, slug: `ayuntamiento-interior-${saveId}` } },
    });
    expect(kingdomLocation!.slug).toBe(`ayuntamiento-interior-${saveId}`);
    expect(kingdomLocation!.slug).not.toBe('campamento-serhu-interior');
  });

  it('siembra 1 Parcela AVANZADA (centro, ya ocupada por el Ayuntamiento real) + 3 BÁSICAS vacías', async () => {
    const kingdomLocation = await prisma.location.findUniqueOrThrow({
      where: { worldId_slug: { worldId, slug: `ayuntamiento-interior-${saveId}` } },
    });
    const ayuntamiento = await prisma.building.findFirstOrThrow({ where: { saveId, recipeKey: 'ayuntamiento' } });
    const parcelas = await prisma.parcela.findMany({ where: { locationId: kingdomLocation.id }, orderBy: { tipo: 'asc' } });
    expect(parcelas).toHaveLength(4);

    const avanzada = parcelas.find((p) => p.tipo === 'AVANZADA');
    expect(avanzada).toBeDefined();
    expect(avanzada!.recipeKeyFijo).toBe('ayuntamiento');
    expect(avanzada!.buildingId).toBe(ayuntamiento.id); // ocupada desde el minuto uno, nunca vacía
    expect(avanzada!.x).toBe(400);
    expect(avanzada!.y).toBe(300);

    const basicas = parcelas.filter((p) => p.tipo === 'BASICA');
    expect(basicas).toHaveLength(3);
    for (const basica of basicas) {
      expect(basica.recipeKeyFijo).toBeNull();
      expect(basica.buildingId).toBeNull(); // vacías, el jugador construye ahí después
    }
  });
});

// Diplomacia del jugador (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4/§ 5-bis punto 6, 2026-09-21) —
// acción puntual de un Companion con rolReino:'diplomatico' contra cualquier Faction real, sin
// exigir nada de la facción destino. Fixture propio, con Reino ya fundado (reutiliza el mismo
// flujo real de POST /reino/fundar en lugar de sembrar Faction a mano, para probar el camino
// completo de verdad).
describe('POST /saves/:id/reino/diplomacia', () => {
  let saveId: string;
  let worldId: string;
  let sourceFactionId: string;
  let targetFactionSlug: string;
  let targetFactionId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (diplomacia)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        raza: 'orcos',
      },
    });
    saveId = save.id;
    await prisma.building.create({
      data: { saveId, locationId: hondonada.id, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
    const app = await buildApp();
    await app.inject({ method: 'POST', url: `/saves/${saveId}/reino/fundar`, payload: { kingdomName: 'Reino de Prueba Diplomacia' } });
    const sourceFaction = await prisma.faction.findFirstOrThrow({ where: { saveId } });
    sourceFactionId = sourceFaction.id;

    const targetFaction = await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'clan-helsig' } });
    targetFactionSlug = targetFaction.slug;
    targetFactionId = targetFaction.id;
  });

  afterAll(async () => {
    await prisma.factionRelation.deleteMany({ where: { OR: [{ sourceFactionId }, { targetFactionId: sourceFactionId }] } });
    await prisma.locationLink.deleteMany({ where: { OR: [{ from: { slug: `ayuntamiento-interior-${saveId}` } }, { to: { slug: `ayuntamiento-interior-${saveId}` } }] } });
    await prisma.location.deleteMany({ where: { worldId, slug: `ayuntamiento-interior-${saveId}` } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin un Companion con rolReino:"diplomatico", rechaza con 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/diplomacia`,
      payload: { companionId: 'no-existe', targetFactionSlug, accion: 'espiar' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('espiar nunca mueve presion, y devuelve el estado real de FactionRelation', async () => {
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Diplomático de prueba', role: 'diplomatico', notes: '', rolReino: 'diplomatico' },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/diplomacia`,
      payload: { companionId: companion.id, targetFactionSlug, accion: 'espiar' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.presion).toBe(50); // PRESION_NEUTRAL, primera vez que se consulta
    expect(body.type).toBe('NEUTRAL');

    const relation = await prisma.factionRelation.findUnique({
      where: { sourceFactionId_targetFactionId: { sourceFactionId, targetFactionId } },
    });
    expect(relation?.presion).toBe(50); // sin cambios — espiar nunca escribe presion
  });

  it('negociar tregua sin nivel de oficio suficiente para una relación ya extrema, rechaza con 409', async () => {
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Diplomático novato', role: 'diplomatico', notes: '', rolReino: 'diplomatico' },
    });
    // Fuerza la relación a un extremo (presion muy alejada del neutro) para que el gate de nivel
    // exija más que el nivel 1 por defecto de un Companion sin ProfessionProgress.
    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId, targetFactionId } },
      update: { presion: 95 },
      create: { worldId, sourceFactionId, targetFactionId, presion: 95, type: 'GUERRA' },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/diplomacia`,
      payload: { companionId: companion.id, targetFactionSlug, accion: 'negociar' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('sabotear con nivel suficiente sube presion de verdad', async () => {
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Diplomático experto', role: 'diplomatico', notes: '', rolReino: 'diplomatico' },
    });
    await prisma.professionProgress.create({ data: { companionId: companion.id, professionId: 'diplomatico', nivel: 9, xp: 8000 } });
    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId, targetFactionId } },
      update: { presion: 50 },
      create: { worldId, sourceFactionId, targetFactionId, presion: 50, type: 'NEUTRAL' },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/diplomacia`,
      payload: { companionId: companion.id, targetFactionSlug, accion: 'sabotear' },
    });
    expect(res.statusCode).toBe(200);
    const relation = await prisma.factionRelation.findUniqueOrThrow({
      where: { sourceFactionId_targetFactionId: { sourceFactionId, targetFactionId } },
    });
    expect(relation.presion).toBe(60); // 50 + peso de SABOTAJE_DIPLOMATICO (+10)
  });

  // H-5 parcial (decisión de Álvaro, 2026-09-29): el diplomático sube de nivel negociando.
  it('varias negociaciones seguidas contra la misma facción suben el nivel de diplomacia y el gate no bloquea', async () => {
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Diplomático aprendiz', role: 'diplomatico', notes: '', rolReino: 'diplomatico' },
    });
    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId, targetFactionId } },
      update: { presion: 50 },
      create: { worldId, sourceFactionId, targetFactionId, presion: 50, type: 'NEUTRAL' },
    });
    const app = await buildApp();
    const niveles: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/reino/diplomacia`,
        payload: { companionId: companion.id, targetFactionSlug, accion: 'negociar' },
      });
      expect(res.statusCode, `negociación ${i + 1}`).toBe(200);
      expect(res.json().xpGanada).toBeGreaterThan(0);
      niveles.push(res.json().nivelDiplomatico);
    }
    expect(niveles).toEqual([2, 3, 4, 5]);
    const progreso = await prisma.professionProgress.findUniqueOrThrow({
      where: { companionId_professionId: { companionId: companion.id, professionId: 'diplomatico' } },
    });
    expect(progreso.nivel).toBe(5);
    expect(progreso.xp).toBe(50 + 100 + 200 + 350);
  });

  it('sabotear y espiar no dan XP de diplomacia', async () => {
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Diplomático sin práctica', role: 'diplomatico', notes: '', rolReino: 'diplomatico' },
    });
    await prisma.factionRelation.update({
      where: { sourceFactionId_targetFactionId: { sourceFactionId, targetFactionId } },
      data: { presion: 50 },
    });
    const app = await buildApp();
    for (const accion of ['espiar', 'sabotear']) {
      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/reino/diplomacia`,
        payload: { companionId: companion.id, targetFactionSlug, accion },
      });
      expect(res.statusCode).toBe(200);
    }
    expect(await prisma.professionProgress.count({ where: { companionId: companion.id, professionId: 'diplomatico' } })).toBe(0);
  });

  it('rechaza diplomacia contra el propio Reino del jugador', async () => {
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Diplomático de prueba 2', role: 'diplomatico', notes: '', rolReino: 'diplomatico' },
    });
    const app = await buildApp();
    const sourceFaction = await prisma.faction.findFirstOrThrow({ where: { id: sourceFactionId } });
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/diplomacia`,
      payload: { companionId: companion.id, targetFactionSlug: sourceFaction.slug, accion: 'espiar' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// Mercado regulado — jugador↔Faction (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4, 2026-09-21) — mismo
// fixture real (Reino fundado, Faction del jugador, facción de catálogo real) que el describe de
// diplomacia, reutilizado para probar el bucle completo: sin tratado no hay comercio, con tratado
// sí, y el precio dinámico responde de verdad al stock real.
describe('POST /saves/:id/reino/mercado/comprar y /vender', () => {
  let saveId: string;
  let worldId: string;
  let sourceFactionId: string;
  let targetFactionSlug: string;
  let targetFactionId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (mercado)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        raza: 'orcos',
        goirnos: 100,
      },
    });
    saveId = save.id;
    await prisma.building.create({
      data: { saveId, locationId: hondonada.id, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
    const app = await buildApp();
    await app.inject({ method: 'POST', url: `/saves/${saveId}/reino/fundar`, payload: { kingdomName: 'Reino de Prueba Mercado' } });
    const sourceFaction = await prisma.faction.findFirstOrThrow({ where: { saveId } });
    sourceFactionId = sourceFaction.id;

    const targetFaction = await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'clan-helsig' } });
    targetFactionSlug = targetFaction.slug;
    targetFactionId = targetFaction.id;
  });

  afterAll(async () => {
    await prisma.almacenItem.deleteMany({ where: { OR: [{ saveId }, { factionId: targetFactionId }] } });
    await prisma.factionRelation.deleteMany({ where: { OR: [{ sourceFactionId }, { targetFactionId: sourceFactionId }] } });
    await prisma.locationLink.deleteMany({ where: { OR: [{ from: { slug: `ayuntamiento-interior-${saveId}` } }, { to: { slug: `ayuntamiento-interior-${saveId}` } }] } });
    await prisma.location.deleteMany({ where: { worldId, slug: `ayuntamiento-interior-${saveId}` } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin tratado comercial, comprar se rechaza con 409', async () => {
    const item = await prisma.almacenItem.create({
      data: { factionId: targetFactionId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/mercado/comprar`,
      payload: { targetFactionSlug, almacenItemId: item.id },
    });
    expect(res.statusCode).toBe(409);
  });

  it('con tratado comercial, comprar mueve goirnos y traspasa el objeto al Almacén del jugador', async () => {
    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId, targetFactionId } },
      update: { type: 'TRATADO_COMERCIAL', presion: 30 },
      create: { worldId, sourceFactionId, targetFactionId, type: 'TRATADO_COMERCIAL', presion: 30 },
    });
    const item = await prisma.almacenItem.create({
      data: { factionId: targetFactionId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' },
    });
    const goirnosAntes = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos;

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/mercado/comprar`,
      payload: { targetFactionSlug, almacenItemId: item.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.precio).toBeGreaterThan(0);

    const goirnosDespues = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos;
    expect(goirnosDespues).toBe(goirnosAntes - body.precio);

    const itemTraspasado = await prisma.almacenItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(itemTraspasado.saveId).toBe(saveId);
    expect(itemTraspasado.factionId).toBeNull();
  });

  it('vender traspasa el objeto a la Faction y cobra goirnos', async () => {
    const item = await prisma.almacenItem.create({
      data: { saveId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' },
    });
    const goirnosAntes = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos;

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/mercado/vender`,
      payload: { targetFactionSlug, almacenItemId: item.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    const goirnosDespues = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos;
    expect(goirnosDespues).toBe(goirnosAntes + body.precio);

    const itemTraspasado = await prisma.almacenItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(itemTraspasado.factionId).toBe(targetFactionId);
    expect(itemTraspasado.saveId).toBeNull();
  });

  it('vender un montón cobra por la cantidad real (F9-5)', async () => {
    const unidad = await prisma.almacenItem.create({
      data: { saveId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' },
    });
    const app = await buildApp();
    const r1 = await app.inject({ method: 'POST', url: `/saves/${saveId}/reino/mercado/vender`, payload: { targetFactionSlug, almacenItemId: unidad.id } });
    expect(r1.statusCode).toBe(200);
    const precioUnidad = r1.json().precio as number;
    expect(r1.json().cantidad).toBe(1);

    const monton = await prisma.almacenItem.create({
      data: { saveId, name: 'Ración de carne fresca (3)', description: 'x', catalogSlug: 'racion-carne' },
    });
    const goirnosAntes = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos;
    const r2 = await app.inject({ method: 'POST', url: `/saves/${saveId}/reino/mercado/vender`, payload: { targetFactionSlug, almacenItemId: monton.id } });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().cantidad).toBe(3);
    expect(r2.json().precio).toBeGreaterThanOrEqual(precioUnidad * 3 - 3);
    const goirnosDespues = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos;
    expect(goirnosDespues).toBe(goirnosAntes + r2.json().precio);
  });

  it('comprar sin goirnos suficientes se rechaza con 400, sin traspasar el objeto', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { goirnos: 0 } });
    const item = await prisma.almacenItem.create({
      data: { factionId: targetFactionId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/mercado/comprar`,
      payload: { targetFactionSlug, almacenItemId: item.id },
    });
    expect(res.statusCode).toBe(400);
    const itemSinTocar = await prisma.almacenItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(itemSinTocar.factionId).toBe(targetFactionId); // nunca se traspasó
  });
});

// Catálogo de mercado (hueco E, rediseño de frontend 2026-09-21) — mismo fixture real (Reino
// fundado, Faction del jugador, facción de catálogo real) que los describes de arriba. Sin este
// GET, comprar exigía conocer de antemano el `almacenItemId` exacto, imposible de descubrir.
describe('GET /saves/:id/reino/mercado/:targetFactionSlug', () => {
  let saveId: string;
  let worldId: string;
  let sourceFactionId: string;
  let targetFactionSlug: string;
  let targetFactionId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (catálogo mercado)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        raza: 'orcos',
        goirnos: 100,
      },
    });
    saveId = save.id;
    await prisma.building.create({
      data: { saveId, locationId: hondonada.id, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
    const app = await buildApp();
    await app.inject({ method: 'POST', url: `/saves/${saveId}/reino/fundar`, payload: { kingdomName: 'Reino de Prueba Catálogo' } });
    const sourceFaction = await prisma.faction.findFirstOrThrow({ where: { saveId } });
    sourceFactionId = sourceFaction.id;

    const targetFaction = await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'clan-helsig' } });
    targetFactionSlug = targetFaction.slug;
    targetFactionId = targetFaction.id;
  });

  afterAll(async () => {
    await prisma.almacenItem.deleteMany({ where: { factionId: targetFactionId, name: 'Ración de carne fresca (catálogo test)' } });
    await prisma.factionRelation.deleteMany({ where: { OR: [{ sourceFactionId }, { targetFactionId: sourceFactionId }] } });
    await prisma.locationLink.deleteMany({ where: { OR: [{ from: { slug: `ayuntamiento-interior-${saveId}` } }, { to: { slug: `ayuntamiento-interior-${saveId}` } }] } });
    await prisma.location.deleteMany({ where: { worldId, slug: `ayuntamiento-interior-${saveId}` } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin tratado comercial: tratado false, items vacío (nunca 409 — es consulta, no acción)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/reino/mercado/${targetFactionSlug}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tratado: false, items: [] });
  });

  it('con tratado comercial: agrupa por catalogSlug, precio dinámico real según stock', async () => {
    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId, targetFactionId } },
      update: { type: 'TRATADO_COMERCIAL', presion: 30 },
      create: { worldId, sourceFactionId, targetFactionId, type: 'TRATADO_COMERCIAL', presion: 30 },
    });
    // 2 filas del MISMO catalogSlug — deben agruparse en 1 item con stock: 2, no 2 items sueltos.
    await prisma.almacenItem.createMany({
      data: [
        { factionId: targetFactionId, name: 'Ración de carne fresca (catálogo test)', description: 'x', catalogSlug: 'racion-carne' },
        { factionId: targetFactionId, name: 'Ración de carne fresca (catálogo test)', description: 'x', catalogSlug: 'racion-carne' },
      ],
    });

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/reino/mercado/${targetFactionSlug}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tratado).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ catalogSlug: 'racion-carne', stock: 2 });
    expect(body.items[0].precio).toBeGreaterThan(0);
    expect(typeof body.items[0].almacenItemId).toBe('string');
  });
});
