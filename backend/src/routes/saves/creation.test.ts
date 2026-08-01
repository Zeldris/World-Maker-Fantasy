import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (deuda técnica 2026-07-30, auditoría técnica: "creation.ts... tiene 0 tests
/// pese a ser el submódulo más grande del split de saves.ts"). Alcance deliberadamente acotado a
/// las validaciones que pasan ANTES de tocar la transacción (mismo criterio que turn.test.ts/
/// saves.test.ts): el resto (creación real del kit inicial dentro de `$transaction`) requeriría
/// mockear prácticamente todo Prisma con muy poco valor extra sobre jugar la partida real.
const findUniqueWorld = vi.fn();
const findUniqueSave = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    world: { findUnique: (...args: unknown[]) => findUniqueWorld(...args) },
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
  },
}));

const { creationRoutes } = await import('./creation.js');

async function buildApp() {
  const app = Fastify();
  await app.register(creationRoutes);
  return app;
}

describe('POST /saves', () => {
  beforeEach(() => {
    findUniqueWorld.mockReset();
  });

  it('400 si faltan campos obligatorios', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves', payload: { characterName: 'Gorhorn' } });
    expect(res.statusCode).toBe(400);
    expect(findUniqueWorld).not.toHaveBeenCalled();
  });

  it('404 si el mundo no existe', async () => {
    findUniqueWorld.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/saves',
      payload: {
        worldSlug: 'no-existe',
        characterName: 'Gorhorn',
        characterArchetype: 'a',
        characterOrigin: 'b',
        characterMotivation: 'c',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        portraitInitial: 'G',
        introCharacterText: 'x',
        introWorldText: 'y',
      },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /saves/:id/restart', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/no-existe/restart', payload: {} });
    expect(res.statusCode).toBe(404);
  });
});
