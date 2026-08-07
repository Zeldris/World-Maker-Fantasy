import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (deuda técnica 2026-07-30, "añadir tests de ruta básicos"): `turn.ts` tenía 0%
/// de test pese a ser el endpoint más crítico de todos (cada turno jugado pasa por aquí). Alcance
/// deliberadamente acotado a las comprobaciones que pasan ANTES de tocar Ollama/turnResolution.ts
/// (400/404/409 de /turn/classify, 400/404 de /turn/narrate) — el resto (clasificación real,
/// streaming NDJSON de /turn/narrate) ya se ejercita en profundidad por turnResolution.test.ts y
/// jugando la partida real; mockear aquí también esa ruta completa duplicaría esa cobertura sin
/// aportar nada nuevo, solo para inflar el número de tests.
const findUniqueSave = vi.fn();
const findUniqueLocation = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    location: { findUnique: (...args: unknown[]) => findUniqueLocation(...args) },
  },
}));

const { turnRoutes } = await import('./turn.js');
const { claimTurnInFlight, releaseTurnInFlight } = await import('../services/turnLock.js');

async function buildApp() {
  const app = Fastify();
  await app.register(turnRoutes);
  return app;
}

describe('POST /turn/classify', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findUniqueLocation.mockReset();
  });

  it('400 si faltan saveId/action', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: 'save1' } });
    expect(res.statusCode).toBe(400);
    expect(findUniqueSave).not.toHaveBeenCalled();
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: 'no-existe', action: 'miro alrededor' } });
    expect(res.statusCode).toBe(404);
  });

  it('409 si la partida ya terminó (endedAt)', async () => {
    const endedAt = new Date();
    findUniqueSave.mockResolvedValue({ id: 'save1', endedAt, characterTransit: null });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: 'save1', action: 'miro alrededor' } });
    expect(res.statusCode).toBe(409);
    expect(res.json().endedAt).toBe(endedAt.toISOString());
  });

  it('409 si el personaje sigue ocupado en un tránsito', async () => {
    const busyUntil = new Date(Date.now() + 60_000);
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      endedAt: null,
      characterTransit: { activity: 'viajando', busyUntil },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: 'save1', action: 'miro alrededor' } });
    expect(res.statusCode).toBe(409);
    expect(res.json().activity).toBe('viajando');
  });
});

describe('POST /turn/narrate', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    releaseTurnInFlight('save1'); // el candado es un Set en memoria, module-level — se limpia entre tests
  });

  it('400 si falta classification', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId: 'save1', action: 'miro alrededor' } });
    expect(res.statusCode).toBe(400);
    expect(findUniqueSave).not.toHaveBeenCalled();
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId: 'no-existe', action: 'miro alrededor', classification: { banda: 'corta' } },
    });
    expect(res.statusCode).toBe(404);
  });

  it('409 si ya hay un turno resolviéndose para esta partida (auditoría de código completa, 2026-08-07)', async () => {
    // Bug real que esto cierra: sin este candado, dos peticiones casi simultáneas (doble clic,
    // reintento de red) para la MISMA partida podían resolverse en paralelo y pisarse la escritura
    // final del Save (xp/nivel/condición física/ubicación) — ver turnLock.ts.
    findUniqueSave.mockResolvedValue({ id: 'save1', worldId: 'w1', world: {}, worldState: {}, inventoryItems: [] });
    claimTurnInFlight('save1');
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId: 'save1', action: 'miro alrededor', classification: { banda: 'corta' } },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().locked).toBe(true);
  });

  it('un segundo turno para OTRA partida no se ve afectado por el candado de la primera', async () => {
    claimTurnInFlight('save1');
    findUniqueSave.mockResolvedValue(null); // llega hasta el 404 real — no se corta en el candado
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId: 'save2', action: 'miro alrededor', classification: { banda: 'corta' } },
    });

    expect(res.statusCode).toBe(404);
  });
});
