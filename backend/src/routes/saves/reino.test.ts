import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (2026-08-04, docs/17-reglas-construcciones-reino.md): el popup de fundación de
/// reino manda aquí el formulario. Regla real a proteger: Gorhorn tiene el nombre de reino
/// bloqueado a "Maktor" — verificado en el backend, no solo ocultando el campo en el frontend
/// (mismo criterio que isStarting/isDynamic en habilidades.ts).
const findUniqueSave = vi.fn();
const findFirstBuilding = vi.fn();
const updateSave = vi.fn();
const updateTerritory = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: {
      findUnique: (...args: unknown[]) => findUniqueSave(...args),
      update: (...args: unknown[]) => updateSave(...args),
    },
    building: {
      findFirst: (...args: unknown[]) => findFirstBuilding(...args),
    },
    territory: {
      update: (...args: unknown[]) => updateTerritory(...args),
    },
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

  it('Gorhorn EXACTO: el nombre se fuerza a "Maktor" pase lo que pase en el body', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Gorhorn' });
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
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Gorhorn de prueba' });
    findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: 't1' });
    updateSave.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: 'Reino de la Estepa' } });

    expect(res.statusCode).toBe(200);
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { kingdomName: 'Reino de la Estepa' } });
  });

  it('rechaza kingdomName vacío para un personaje que no es Gorhorn', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje' });
    findFirstBuilding.mockResolvedValue({ id: 'b1', territoryId: 't1' });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/reino/fundar', payload: { kingdomName: '   ' } });

    expect(res.statusCode).toBe(400);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('actualiza la description del Territory si se manda y el Building tiene territoryId', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje' });
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
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Otro personaje' });
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
});
