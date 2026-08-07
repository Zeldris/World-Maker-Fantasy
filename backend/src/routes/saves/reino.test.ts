import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (2026-08-04, docs/17-reglas-construcciones-reino.md): el popup de fundación de
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
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: 'x' } });

    expect(res.statusCode).toBe(404);
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
