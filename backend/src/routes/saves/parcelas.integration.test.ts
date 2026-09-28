import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { parcelasRoutes } from './parcelas.js';

/// Concepto de "parcela" estilo Travian/Tribal Wars (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4,
/// 2026-09-21) — flujo real: clic en el icono de la parcela abre modal (GET), botón "Construir"
/// construye DIRECTO sin narración de LLM (POST). Test de integración real contra Postgres, sin
/// mocks — mismo patrón que descansarCampamento.integration.test.ts.
const ATTRS = { fuerza: 20, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 20, magia: 10 };

async function buildApp() {
  const app = Fastify();
  await app.register(parcelasRoutes);
  return app;
}

describe('Parcelas — GET estado / POST construir (2026-09-21)', () => {
  let saveId: string;
  let worldId: string;
  let hondonadaId: string;
  let kingdomLocationId: string;
  let avanzadaId: string;
  let basicaId: string;

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
        characterName: 'Gorhorn de prueba (parcelas)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonadaId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 500 } });

    const kingdomLocation = await prisma.location.create({
      data: { worldId, slug: `parcelas-test-interior-${saveId}`, name: 'Hogar de prueba', region: 'Las Llanuras del Viento Rojo', kind: 'interior', description: 'x', aliases: [] },
    });
    kingdomLocationId = kingdomLocation.id;

    const ayuntamiento = await prisma.building.create({
      data: { saveId, locationId: kingdomLocationId, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1, x: 400, y: 300 },
    });

    const avanzada = await prisma.parcela.create({
      data: { locationId: kingdomLocationId, x: 400, y: 300, tipo: 'AVANZADA', recipeKeyFijo: 'ayuntamiento', buildingId: ayuntamiento.id },
    });
    avanzadaId = avanzada.id;
    const basica = await prisma.parcela.create({
      data: { locationId: kingdomLocationId, x: 400, y: 150, tipo: 'BASICA' },
    });
    basicaId = basica.id;
  });

  afterAll(async () => {
    await prisma.parcela.deleteMany({ where: { locationId: kingdomLocationId } });
    await prisma.building.deleteMany({ where: { saveId } });
    await prisma.location.delete({ where: { id: kingdomLocationId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  describe('GET /saves/:id/parcelas/:parcelaId', () => {
    it('parcela AVANZADA ya ocupada (el Ayuntamiento real): ocupada:true, sin candidatas', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/parcelas/${avanzadaId}` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ocupada).toBe(true);
      expect(body.building.name).toBe('x');
      expect(body.candidates).toEqual([]);
    });

    it('parcela BASICA vacía: candidatas = recetas de reino disponibles (Choza), con su blockedReason real', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/parcelas/${basicaId}` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ocupada).toBe(false);
      const choza = body.candidates.find((c: { recipeKey: string }) => c.recipeKey === 'choza');
      expect(choza).toBeDefined();
      // Sin materiales todavía en el inventario — no cumplida, pero SIN blockedReason de reino
      // (Ayuntamiento ya existe, misma región, cupo libre): el único problema real es materiales.
      expect(choza.met).toBe(false);
      expect(choza.blockedReason).toBeNull();
    });

    it('404 si la parcela no existe', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/parcelas/no-existe` });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /saves/:id/parcelas/:parcelaId/construir', () => {
    it('rechaza si la parcela AVANZADA recibe una receta que no es su recipeKeyFijo', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/parcelas/${avanzadaId}/construir`, payload: { recipeKey: 'choza' } });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/ya tiene un edificio construido|solo admite construir/);
    });

    it('rechaza construir en BASICA sin materiales suficientes', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/parcelas/${basicaId}/construir`, payload: { recipeKey: 'choza' } });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/materiales/);
    });

    it('con materiales reales, construye de verdad: consume inventario, crea Building en la posición de la parcela, enlaza Parcela.buildingId, y narra un LogEntry determinista rico en datos', async () => {
      await prisma.inventoryItem.createMany({
        data: [
          { saveId, name: 'Piel', description: 'x', catalogSlug: 'lana-murgol' },
          { saveId, name: 'Piel', description: 'x', catalogSlug: 'lana-murgol' },
          { saveId, name: 'Piel', description: 'x', catalogSlug: 'lana-murgol' },
          { saveId, name: 'Piel', description: 'x', catalogSlug: 'lana-murgol' },
          { saveId, name: 'Piel', description: 'x', catalogSlug: 'lana-murgol' },
          { saveId, name: 'Piel', description: 'x', catalogSlug: 'lana-murgol' },
          { saveId, name: 'Piel', description: 'x', catalogSlug: 'lana-murgol' },
          { saveId, name: 'Piel', description: 'x', catalogSlug: 'lana-murgol' },
          { saveId, name: 'Piel', description: 'x', catalogSlug: 'lana-murgol' },
          { saveId, name: 'Piel', description: 'x', catalogSlug: 'lana-murgol' },
          { saveId, name: 'Hueso largo de gargantúa (6)', description: 'x', catalogSlug: 'hueso-largo-gargantua' },
          { saveId, name: 'Cuerda de tendón (4)', description: 'x', catalogSlug: 'cuerda-tendon' },
        ],
      });
      // constructor-orcos-llanuras no está en OFICIOS_CONSTRUCCION_REQUERIDOS a nivel Choza (tier
      // de entrada) — no hace falta profesión aprendida, solo materiales+requisitos de atributo.
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/parcelas/${basicaId}/construir`, payload: { recipeKey: 'choza' } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.building.name).toBe('Choza Básica Orco de las Llanuras');
      expect(body.building.x).toBe(400);
      expect(body.building.y).toBe(150);
      expect(body.building.status).toBe('ACTIVO');
      expect(body.logEntry.channel).toBe('world');
      expect(body.logEntry.text).toContain('Choza Básica Orco de las Llanuras');
      expect(body.logEntry.text).toContain('Hogar de prueba');
      expect(body.logEntry.text).toContain('Gorhorn de prueba (parcelas)');

      const parcelaAfter = await prisma.parcela.findUniqueOrThrow({ where: { id: basicaId } });
      expect(parcelaAfter.buildingId).toBe(body.building.id);

      const remainingPiel = await prisma.inventoryItem.count({ where: { saveId, catalogSlug: 'lana-murgol' } });
      expect(remainingPiel).toBe(0); // las 10 pieles se consumieron exactamente (Choza pide 10)
    });

    it('una vez ocupada, un segundo intento de construir en la misma parcela se rechaza', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/parcelas/${basicaId}/construir`, payload: { recipeKey: 'choza' } });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/ya tiene un edificio construido/);
    });

    // Sin `tier`, el gate NIVEL_EDIFICIO_INSUFICIENTE y las plazas de trabajador no se aplicarían
    // nunca en partida real (el Building quedaba con tier null).
    it('un edificio de oficio construido en parcela nace con tier 1 (Taller)', async () => {
      const segunda = await prisma.parcela.create({ data: { locationId: kingdomLocationId, x: 250, y: 150, tipo: 'BASICA' } });
      await prisma.inventoryItem.createMany({
        data: [
          { saveId, name: 'Piedra (12)', description: 'x', catalogSlug: 'piedra' },
          { saveId, name: 'Mena de hierro (6)', description: 'x', catalogSlug: 'mena-hierro-llanuras' },
          { saveId, name: 'Piedra de afilar', description: 'x', catalogSlug: 'piedra-de-afilar' },
        ],
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/parcelas/${segunda.id}/construir`, payload: { recipeKey: 'herreria' } });
      expect(res.statusCode).toBe(200);
      const building = await prisma.building.findUniqueOrThrow({ where: { id: res.json().building.id } });
      expect(building.recipeKey).toBe('herreria');
      expect(building.tier).toBe(1);
    });
  });
});
