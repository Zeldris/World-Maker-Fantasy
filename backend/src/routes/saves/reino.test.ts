import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';

/// Cobertura nueva (2026-08-04, docs/mecanicas/17-reglas-construcciones-reino.md): el popup de fundación de
/// reino manda aquí el formulario. Regla real a proteger: Gorhorn tiene el nombre de reino
/// bloqueado a "Maktor" — verificado en el backend, no solo ocultando el campo en el frontend
/// (mismo criterio que isStarting/isDynamic en habilidades.ts).
///
/// Extendido 2026-08-06: fundar el reino TAMBIÉN funda la propia Faction (ver reino.ts) — todo
/// dentro de una única transacción (`$transaction`), simulada aquí devolviendo un `tx` falso con
/// los mismos mocks que antes vivían sueltos en `prisma` directamente.
const findUniqueSave = vi.fn();
const findFirstBuilding = vi.fn();
const updateSave = vi.fn();
const updateTerritory = vi.fn();
const createFaction = vi.fn();
const createDiscoveredEntity = vi.fn();
const createManyPlantillaEquipo = vi.fn();
// Zona-interior navegable propia del reino (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21).
const createLocation = vi.fn();
const createLocationLink = vi.fn();
const createParcela = vi.fn();
const createManyParcela = vi.fn();

// Libro de Sucesos (CR-3): tiene sus propios tests; aquí la transacción simulada no lo lleva.
vi.mock('../../services/cronista/sucesos.js', () => ({ registrarSuceso: vi.fn(async () => 'suceso-1'), minutosDeFiccion: vi.fn(async () => 480) }));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: {
      findUnique: (...args: unknown[]) => findUniqueSave(...args),
    },
    building: {
      findFirst: (...args: unknown[]) => findFirstBuilding(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        save: { update: (...args: unknown[]) => updateSave(...args) },
        territory: { update: (...args: unknown[]) => updateTerritory(...args) },
        faction: { create: (...args: unknown[]) => createFaction(...args) },
        discoveredEntity: { create: (...args: unknown[]) => createDiscoveredEntity(...args) },
        plantillaEquipo: { createMany: (...args: unknown[]) => createManyPlantillaEquipo(...args) },
        location: { create: (...args: unknown[]) => createLocation(...args) },
        locationLink: { create: (...args: unknown[]) => createLocationLink(...args) },
        parcela: {
          create: (...args: unknown[]) => createParcela(...args),
          createMany: (...args: unknown[]) => createManyParcela(...args),
        },
      }),
  },
}));

const { reinoRoutes } = await import('./reino.js');

async function buildApp() {
  const app = Fastify();
  await app.register(reinoRoutes);
  return app;
}

describe('POST /saves/:id/reino/fundar', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findFirstBuilding.mockReset();
    updateSave.mockReset();
    updateTerritory.mockReset();
    createFaction.mockReset().mockResolvedValue({ slug: 'reino-de-la-estepa-save1' });
    createDiscoveredEntity.mockReset().mockResolvedValue({});
    createManyPlantillaEquipo.mockReset().mockResolvedValue({ count: 3 });
    createLocation.mockReset().mockResolvedValue({ id: 'kingdom-location-1' });
    createLocationLink.mockReset().mockResolvedValue({});
    createParcela.mockReset().mockResolvedValue({});
    createManyParcela.mockReset().mockResolvedValue({ count: 3 });
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: 'x' } });

    expect(res.statusCode).toBe(404);
    expect(updateSave).not.toHaveBeenCalled();
  });

  // Bug real (auditoría de bugs, 2026-08-21): esta ruta nunca comprobaba `save.endedAt` — con la
  // partida ya terminada por muerte definitiva, seguía dejando fundar un reino nuevo (mutación
  // real: Save.kingdomName + Faction + DiscoveredEntity) para un personaje que la propia partida
  // ya da por definitivamente muerto.
  it('409 si la partida ya ha terminado (endedAt)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Gorhorn de prueba', endedAt: new Date('2026-08-21T12:00:00Z') });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: 'x' } });

    expect(res.statusCode).toBe(409);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('400 si todavía no ha construido ningún Ayuntamiento', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Gorhorn de prueba' });
    findFirstBuilding.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: 'x' } });

    expect(res.statusCode).toBe(400);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('400 si ya había fundado su reino antes (evita reventar el slug determinista de Faction)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje', kingdomName: 'Ya fundado', worldId: 'w1', raza: 'orcos' });
    findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: 't1' });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: 'Otro nombre' } });

    expect(res.statusCode).toBe(400);
    expect(createFaction).not.toHaveBeenCalled();
  });

  it('400 si el personaje no tiene raza asignada (no habría bajo qué agrupar la facción)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje', kingdomName: null, worldId: 'w1', raza: null });
    findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: 't1' });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: 'Reino de la Estepa' } });

    expect(res.statusCode).toBe(400);
    expect(createFaction).not.toHaveBeenCalled();
  });

  it('Gorhorn EXACTO: el nombre se fuerza a "Maktor" pase lo que pase en el body', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Gorhorn', kingdomName: null, worldId: 'w1', raza: 'orcos' });
    findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: 't1' });
    updateSave.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/reino/fundar',
      payload: { kingdomName: 'Un nombre inventado por el jugador' },
    });

    expect(res.statusCode).toBe(200);
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { kingdomName: 'Maktor' } });
    expect(JSON.parse(res.body)).toEqual({ kingdomName: 'Maktor' });
    // Plantillas básicas (hueco real cerrado, auditoría de lore 2026-08-25): se siembran las 3,
    // no editables, en la misma transacción que funda el reino.
    expect(createManyPlantillaEquipo).toHaveBeenCalledWith({
      data: [
        { name: 'Guardia básico', rol: 'guardia', prioridad: 0, slots: { ARMA_PRINCIPAL: { category: 'arma' }, ARMADURA_SUPERIOR: { category: 'ropa' } }, saveId: 'save1', personalizada: false },
        { name: 'Trabajador básico', rol: 'trabajador', prioridad: 1, slots: { ARMA_SECUNDARIA: { category: 'herramienta' } }, saveId: 'save1', personalizada: false },
        { name: 'Productor básico', rol: 'productor', prioridad: 1, slots: { ARMA_SECUNDARIA: { category: 'herramienta' } }, saveId: 'save1', personalizada: false },
      ],
    });
  });

  it('un personaje que NO es Gorhorn ("Gorhorn de prueba" u otro): el nombre del body se respeta', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Gorhorn de prueba', kingdomName: null, worldId: 'w1', raza: 'goirntes' });
    findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: 't1' });
    updateSave.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: 'Reino de la Estepa' } });

    expect(res.statusCode).toBe(200);
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { kingdomName: 'Reino de la Estepa' } });
  });

  it('rechaza kingdomName vacío para un personaje que no es Gorhorn', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje', kingdomName: null, worldId: 'w1', raza: 'goirntes' });
    findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: 't1' });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: '   ' } });

    expect(res.statusCode).toBe(400);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('actualiza la description del Territory si se manda y el Building tiene territoryId', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje', kingdomName: null, worldId: 'w1', raza: 'goirntes' });
    findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: 't1' });
    updateSave.mockResolvedValue({});
    updateTerritory.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/reino/fundar',
      payload: { kingdomName: 'Reino de la Estepa', description: 'Una nueva descripción' },
    });

    expect(res.statusCode).toBe(200);
    expect(updateTerritory).toHaveBeenCalledWith({ where: { id: 't1' }, data: { description: 'Una nueva descripción' } });
  });

  it('sin territoryId en el Building, no intenta actualizar ningún Territory', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje', kingdomName: null, worldId: 'w1', raza: 'goirntes' });
    findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: null });
    updateSave.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/reino/fundar',
      payload: { kingdomName: 'Reino de la Estepa', description: 'x' },
    });

    expect(res.statusCode).toBe(200);
    expect(updateTerritory).not.toHaveBeenCalled();
  });

  describe('fundar el reino también funda la propia Faction (2026-08-06)', () => {
    it('crea la Faction con worldId/saveId/name/raza y la descripción escrita, y su DiscoveredEntity', async () => {
      findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje', kingdomName: null, worldId: 'w1', raza: 'goirntes' });
      findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: 't1' });
      updateSave.mockResolvedValue({});
      updateTerritory.mockResolvedValue({});
      createFaction.mockResolvedValue({ slug: 'reino-de-la-estepa-save1' });
      const app = await buildApp();

      await app.inject({
        method: 'POST',
        url: '/saves/save1/reino/fundar',
        payload: { kingdomName: 'Reino de la Estepa', description: 'Una nueva descripción' },
      });

      expect(createFaction).toHaveBeenCalledWith({
        data: {
          worldId: 'w1',
          saveId: 'save1',
          slug: 'reino-de-la-estepa-save1',
          name: 'Reino de la Estepa',
          raza: 'goirntes',
          description: 'Una nueva descripción',
        },
      });
      expect(createDiscoveredEntity).toHaveBeenCalledWith({
        data: { saveId: 'save1', entityType: 'faction', entitySlug: 'reino-de-la-estepa-save1' },
      });
    });

    it('sin descripción, la Faction se crea con un texto por defecto en vez de vacío', async () => {
      findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje', kingdomName: null, worldId: 'w1', raza: 'orcos' });
      findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: null });
      updateSave.mockResolvedValue({});
      const app = await buildApp();

      await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: 'Reino de la Estepa' } });

      expect(createFaction).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ description: 'Facción fundada por Otro personaje.' }) }),
      );
    });

    it('condición de carrera (auditoría 2026-08-07): dos fundaciones casi simultáneas — la segunda choca contra el slug único y da 400, no 500', async () => {
      findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje', kingdomName: null, worldId: 'w1', raza: 'orcos' });
      findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: null });
      updateSave.mockResolvedValue({});
      createFaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '0.0.0' }),
      );
      const app = await buildApp();

      const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: 'Reino de la Estepa' } });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/Ya has fundado tu reino/);
    });

    it('el slug de la Faction incluye el saveId — dos partidas con el mismo nombre de reino no chocan', async () => {
      findUniqueSave.mockResolvedValue({ id: 'save-A', characterName: 'Otro personaje', kingdomName: null, worldId: 'w1', raza: 'orcos' });
      findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: null });
      updateSave.mockResolvedValue({});
      const app = await buildApp();

      await app.inject({ method: 'POST', url: '/saves/save-A/reino/fundar', payload: { kingdomName: 'Maktor' } });

      expect(createFaction).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ slug: 'maktor-save-A' }) }));
    });
  });
});
