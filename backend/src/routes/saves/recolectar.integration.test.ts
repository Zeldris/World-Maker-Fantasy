import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import type { AttributeBlock } from '../../services/dice.js';

/// Harness de integración real (mismo criterio que turn.integration.test.ts/creation.integration.
/// test.ts — sin LLM de por medio en /recolectar, así que Postgres local basta) para el bug real
/// jugando en vivo (2026-08-13, "avanzo por la hondonada buscando más elementos... ahí sí que
/// debería poder volver a usarla, al igual que si cambiamos de zona"): el cooldown de 30 min era
/// puro reloj, sin memoria de sitio — moverse a otra Location no servía de nada. Usa la fila REAL
/// (compartida, mundo `helek-sirik`) de 'roca-pilares-rotos' — snapshot/restore exactos en
/// beforeAll/afterAll para no dejar la partida real de la jugadora con población o cooldown
/// alterados tras correr los tests.
const { recolectarRoutes, candidateSourcesFor, gatheringRollFor, applyGatheringRoll } = await import('./recolectar.js');
const { estacionFor, climaFor } = await import('../../services/worldClock.js');

async function buildApp() {
  const app = Fastify();
  await app.register(recolectarRoutes);
  return app;
}

describe('Cooldown de recolección: cambiar de Location lo salta, quedarse quieto no', () => {
  let saveId: string;
  let worldId: string;
  let locationAId: string;
  let locationBId: string;
  let originalPopulation: { poblacion: number; lastHarvestedAt: Date | null; lastHarvestedLocationId: string | null };

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const locationA = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'agujas-iman' } });
    const locationB = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-serhu' } });
    locationAId = locationA.id;
    locationBId = locationB.id;

    const pop = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId, targetType: 'RECURSO', targetSlug: 'roca-pilares-rotos' },
    });
    originalPopulation = { poblacion: pop.poblacion, lastHarvestedAt: pop.lastHarvestedAt, lastHarvestedLocationId: pop.lastHarvestedLocationId };
    // Punto de partida limpio: nunca recolectada (cooldown irrelevante hasta que el propio test lo
    // fije), para que el primer harvest de Location A no dependa de cuándo se corrió la suite
    // anterior.
    await prisma.worldPopulation.update({
      where: { id: pop.id },
      data: { lastHarvestedAt: null, lastHarvestedLocationId: null },
    });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba 19',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationAId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.worldPopulation.updateMany({
      where: { worldId, targetType: 'RECURSO', targetSlug: 'roca-pilares-rotos' },
      data: originalPopulation,
    });
  });

  it('recolecta en Location A, un segundo intento inmediato en el MISMO sitio no da nada nuevo', async () => {
    const app = await buildApp();

    const first = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/recolectar/confirmar`,
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });
    expect(first.statusCode).toBe(200);
    const afterFirst = JSON.parse(first.body);
    expect(afterFirst.items).toHaveLength(1);
    // Nombre real actualizado (2026-09-02, commit 445dd4d "renombra recursos genéricos con
    // identidad regional", ajeno a esta tarea) — el item `slug: 'piedra'` pasó a llamarse "Roca de
    // Llanura Roja", este test se había quedado con el nombre viejo tras ese rename.
    expect(afterFirst.items[0].name).toBe('Roca de Llanura Roja (3)');

    const popAfterFirst = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId, targetType: 'RECURSO', targetSlug: 'roca-pilares-rotos' },
    });
    expect(popAfterFirst.poblacion).toBe(originalPopulation.poblacion - 3);
    expect(popAfterFirst.lastHarvestedLocationId).toBe(locationAId);

    // Mismo sitio, sin esperar nada — sigue en cooldown, la petición no crea ni actualiza nada.
    const second = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/recolectar/confirmar`,
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).items).toHaveLength(0);
    const popAfterSecond = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId, targetType: 'RECURSO', targetSlug: 'roca-pilares-rotos' },
    });
    expect(popAfterSecond.poblacion).toBe(originalPopulation.poblacion - 3);
  }, 15_000);

  // Hallazgo 44 (revisar-partida-hallazgos.md, 2026-09-15): `resolverRecoleccion` ganó un tercer
  // parámetro opcional (`clearPendingDynamicModeOffer`) para que dynamicModeRecurso.ts pueda
  // limpiar la oferta de Interactuar DENTRO de la misma transacción — este endpoint (el otro
  // caller, `/recolectar/confirmar`) nunca debe activarlo: no toca `pendingDynamicModeOffer` en
  // absoluto, esa oferta es responsabilidad exclusiva del flujo de Interactuar.
  it('recolectar por el modal normal (/recolectar/confirmar) NO toca una oferta de Interactuar ya activa', async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'RECURSO', targetSlug: 'yerreo', targetName: 'Yerreo' } },
    });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/recolectar/confirmar`,
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });
    expect(res.statusCode).toBe(200);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicModeOffer).toEqual({ tipo: 'RECURSO', targetSlug: 'yerreo', targetName: 'Yerreo' });
  }, 15_000);

  it('moverse a Location B deja recolectar de inmediato, aunque no hayan pasado los 30 min', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: locationBId } });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/recolectar/confirmar`,
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });
    expect(res.statusCode).toBe(200);
    // Ya existe una pila de "Roca de Llanura Roja" del test anterior en este mismo save — se
    // acumula en vez de crear una fila nueva (`updatedItems`, no `items`), mismo criterio que el
    // resto del motor.
    const body = JSON.parse(res.body);
    expect(body.updatedItems).toEqual([expect.objectContaining({ name: 'Roca de Llanura Roja (6)' })]);

    const pop = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId, targetType: 'RECURSO', targetSlug: 'roca-pilares-rotos' },
    });
    expect(pop.poblacion).toBe(originalPopulation.poblacion - 6);
    expect(pop.lastHarvestedLocationId).toBe(locationBId);
  }, 15_000);
});

/// Profesión "pescador" nueva (2026-09-02, Pieza 1/2/3) — contra el catálogo REAL sembrado
/// (Playa de Ceniza Blanca, jashil-verde/toluh/bulco-de-arena): confirma que las 6 filas de
/// HarvestYield nuevas (seed-catalog.ts § worldCatalog.ts) de verdad enganchan con el motor de
/// principio a fin — Explorar → confirmar, sin mockear nada. No toca `WorldPopulation` real de
/// jashil/bulco (Pescar/Buscar nunca depletan población, ver `esFaunaMetodo`), así que no hace
/// falta snapshot/restore de esas filas — solo borrar la partida/inventario de prueba al final.
describe('Pescador (PESCA/BUSQUEDA) contra el catálogo real sembrado', () => {
  let saveId: string;
  let worldId: string;
  let playaLocationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const playa = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'playa-de-ceniza-blanca' } });
    playaLocationId = playa.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba pescador',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        // Atributos altos en fuerza/voluntad/inteligencia/destreza: éxito garantizado tanto en la
        // tirada de Explorar (fuerza/voluntad) como en la segunda tirada de Toluh (inteligencia,
        // tier 7) — estos tests no dependen del azar de Math.random.
        attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 20, voluntad: 20, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: playaLocationId,
        // Nivel 7 en 'pescador' (Pieza 3) — necesario para que Toluh (tier 7) sea candidato.
        professionProgress: { create: { professionId: 'pescador', nivel: 7 } },
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });

    const canaCatalog = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, slug: 'cana-pesca' } });
    const ceboCatalog = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, slug: 'cebo-pesca' } });
    await prisma.inventoryItem.create({
      data: { saveId, name: canaCatalog.name, description: canaCatalog.description, catalogSlug: canaCatalog.slug },
    });
    await prisma.inventoryItem.create({
      data: { saveId, name: 'Cebo (5)', description: ceboCatalog.description, catalogSlug: ceboCatalog.slug },
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  // Fase 4 (2026-09-28) retira `POST /recolectar/:oficio/explorar` (sin llamador — Pescar ya no
  // tiene botón, solo se pesca desde el mapa de la zona vía `dynamicModeRecurso.ts`) — mismo
  // camino real que ese router: `candidateSourcesFor` + `gatheringRollFor` + `applyGatheringRoll`
  // llamados directamente, sin pasar por ninguna ruta HTTP.
  it('Explorar con Pescar localiza peces reales de la costa (jashil/negueo/toluh), no marisco', async () => {
    const save = await prisma.save.findUniqueOrThrow({
      where: { id: saveId },
      include: { inventoryItems: { where: { slot: { not: null } }, select: { statBonuses: true } }, professionProgress: { select: { professionId: true, nivel: true } } },
    });
    const estacionActual = estacionFor(480);
    const climaActual = climaFor(480, 'Las Llanuras del Viento Rojo');
    const { candidates } = await candidateSourcesFor(worldId, 'PESCA', 'Las Llanuras del Viento Rojo', playaLocationId, 'playa-de-ceniza-blanca', estacionActual, climaActual, 7);
    const roll = gatheringRollFor(
      { attributes: save.attributes as AttributeBlock, secondaryAttributesJson: save.secondaryAttributes, inventoryItems: save.inventoryItems, professionProgress: save.professionProgress },
      'pescador-pescar',
    );
    const sources = applyGatheringRoll(candidates, roll);

    expect(sources.length).toBeGreaterThan(0);
    const itemSlugs = sources.flatMap((s) => s.yields.map((y) => y.itemSlug));
    expect(itemSlugs.every((slug: string) => ['carne-jashil', 'carne-negueo', 'carne-toluh', 'escamas-toluh'].includes(slug))).toBe(true);
    expect(itemSlugs).not.toContain('bulco-arena-marisco');
  }, 15_000);

  it('confirmar Pescar da el pez y consume 1 cebo de la pila, sin tocar ninguna WorldPopulation', async () => {
    const app = await buildApp();
    const jashilPop = await prisma.worldPopulation.findFirstOrThrow({ where: { worldId, targetType: 'FAUNA', targetSlug: 'jashil-verde' } });

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/recolectar/confirmar`,
      payload: { selections: [{ sourceSlug: 'jashil-verde', itemSlug: 'carne-jashil', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items.some((i: { name: string }) => i.name.includes('Carne de Jashil'))).toBe(true);

    const jashilPopAfter = await prisma.worldPopulation.findFirstOrThrow({ where: { worldId, targetType: 'FAUNA', targetSlug: 'jashil-verde' } });
    expect(jashilPopAfter.poblacion).toBe(jashilPop.poblacion);

    const ceboRow = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, catalogSlug: 'cebo-pesca' } });
    expect(ceboRow.name).toBe('Cebo (4)');
  }, 15_000);

  // Fase 10 (2026-09-29, "todas las tiradas visibles") — la segunda tirada de tier alto (>= 6) ya no se
  // descarta: se devuelve por objeto afectado y queda en `LogEntry.roll`. Toluh es tier 7 (inteligencia
  // 20 -> +10, dificultad 17); `Math.random` fijado alto (d20 = 20) para que no dependa del azar.
  it('confirmar un objeto tier 7 devuelve su segunda tirada (segundasTiradas) y la guarda en LogEntry.roll', async () => {
    const app = await buildApp();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let res;
    try {
      res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/recolectar/confirmar`,
        payload: { selections: [{ sourceSlug: 'toluh', itemSlug: 'carne-toluh', cantidad: 1 }] },
      });
    } finally {
      randomSpy.mockRestore();
    }
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.segundasTiradas).toHaveLength(1);
    const segunda = body.segundasTiradas[0];
    expect(segunda).toMatchObject({ sourceSlug: 'toluh', itemSlug: 'carne-toluh', dificultad: 17, paso: true, grado: 'claro' });
    expect(segunda.roll).toMatchObject({ attribute: 'inteligencia', usedRoll: 20, advantage: false });
    expect(segunda.roll.result).toBe(20 + 10 + segunda.roll.bonusOficio);
    expect(body.logEntry.roll).toEqual({ kind: 'recoleccion', segundas: body.segundasTiradas });
    const guardada = await prisma.logEntry.findUniqueOrThrow({ where: { id: body.logEntry.id } });
    expect(guardada.roll).toEqual({ kind: 'recoleccion', segundas: body.segundasTiradas });
  }, 15_000);

  // Fase 4 (2026-09-28) — ver comentario del test de Pescar arriba (mismo motivo, mismo camino
  // directo contra `candidateSourcesFor`/`gatheringRollFor`/`applyGatheringRoll`).
  it('Explorar con Buscar localiza marisco (bulco-arena-marisco), no peces', async () => {
    const save = await prisma.save.findUniqueOrThrow({
      where: { id: saveId },
      include: { inventoryItems: { where: { slot: { not: null } }, select: { statBonuses: true } }, professionProgress: { select: { professionId: true, nivel: true } } },
    });
    const estacionActual = estacionFor(480);
    const climaActual = climaFor(480, 'Las Llanuras del Viento Rojo');
    const { candidates } = await candidateSourcesFor(worldId, 'BUSQUEDA', 'Las Llanuras del Viento Rojo', playaLocationId, 'playa-de-ceniza-blanca', estacionActual, climaActual, 7);
    const roll = gatheringRollFor(
      { attributes: save.attributes as AttributeBlock, secondaryAttributesJson: save.secondaryAttributes, inventoryItems: save.inventoryItems, professionProgress: save.professionProgress },
      'pescador-buscar',
    );
    const sources = applyGatheringRoll(candidates, roll);

    expect(sources.length).toBeGreaterThan(0);
    const itemSlugs = sources.flatMap((s) => s.yields.map((y) => y.itemSlug));
    expect(itemSlugs).toEqual(['bulco-arena-marisco']);
  }, 15_000);

  it('confirmar Buscar da el marisco sin ninguna herramienta (caña/cebo no aplican a BUSQUEDA)', async () => {
    const app = await buildApp();
    const ceboAntes = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, catalogSlug: 'cebo-pesca' } });

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/recolectar/confirmar`,
      payload: { selections: [{ sourceSlug: 'bulco-de-arena', itemSlug: 'bulco-arena-marisco', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items.some((i: { name: string }) => i.name.includes('Bulco de Arena'))).toBe(true);

    // Buscar no toca el cebo — sigue igual que tras el test anterior.
    const ceboDespues = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, catalogSlug: 'cebo-pesca' } });
    expect(ceboDespues.name).toBe(ceboAntes.name);
  }, 15_000);
});

/// Cobertura de integración real (hallazgo 29b, revisar-partida-hallazgos.md 2026-09-07) —
/// `candidateSourcesFor` ya respetaba `harvestSourceHomeLocationSlug` antes de este hallazgo, pero
/// solo admitía una Location única; este test confirma el soporte nuevo de varias Locations a la
/// vez (`bulbo-del-cauce`/`liquen-del-cauce`, misma corriente subterránea que aflora en 3 puntos) y
/// que un recurso con candado a una sola Location (`flor-de-ceniza`) sigue funcionando igual que
/// antes. Población real ya sembrada en `worldPopulation.ts`, sin necesitar sembrar a mano.
describe('Recolectar: candidateSourcesFor respeta harvestSourceHomeLocationSlug con varias Locations (hallazgo 29b, 2026-09-07)', () => {
  let worldId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
  });

  it('Bulbo del Cauce (candado a 3 Locations a la vez) aparece en las 3, no en una cuarta de la misma región', async () => {
    const enPozo = await candidateSourcesFor(worldId, 'EXTRACCION', 'Las Llanuras del Viento Rojo', null, 'pozo-cauce-viejo', 'VERANO', null, 1);
    const enManaderos = await candidateSourcesFor(worldId, 'EXTRACCION', 'Las Llanuras del Viento Rojo', null, 'manaderos', 'VERANO', null, 1);
    const enOasis = await candidateSourcesFor(worldId, 'EXTRACCION', 'Las Llanuras del Viento Rojo', null, 'oasis-de-chudos-rojos', 'VERANO', null, 1);
    const enHondonada = await candidateSourcesFor(worldId, 'EXTRACCION', 'Las Llanuras del Viento Rojo', null, 'hondonada-del-eco', 'VERANO', null, 1);

    expect(enPozo.candidates.some((c) => c.sourceSlug === 'bulbo-del-cauce')).toBe(true);
    expect(enManaderos.candidates.some((c) => c.sourceSlug === 'bulbo-del-cauce')).toBe(true);
    expect(enOasis.candidates.some((c) => c.sourceSlug === 'bulbo-del-cauce')).toBe(true);
    expect(enHondonada.candidates.some((c) => c.sourceSlug === 'bulbo-del-cauce')).toBe(false);
  });

  it('Flor de Ceniza (candado a una sola Location) SÍ aparece en Fumarolas Negras, NUNCA en otra Location de la misma región', async () => {
    const enFumarolas = await candidateSourcesFor(worldId, 'EXTRACCION', 'Las Llanuras del Viento Rojo', null, 'fumarolas-negras', 'VERANO', null, 1);
    const enHondonada = await candidateSourcesFor(worldId, 'EXTRACCION', 'Las Llanuras del Viento Rojo', null, 'hondonada-del-eco', 'VERANO', null, 1);

    expect(enFumarolas.candidates.some((c) => c.sourceSlug === 'flor-de-ceniza')).toBe(true);
    expect(enHondonada.candidates.some((c) => c.sourceSlug === 'flor-de-ceniza')).toBe(false);
  });
});
