import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (auditoría 2026-08-06): `POST /saves/:id/transit/cancel` solo comprobaba
/// `busyUntil > ahora` para decidir "esto se puede cancelar" — pero `worldTick.ts` empuja ese
/// mismo campo al reclamar un tránsito para narrarlo (10 min de colchón), así que el endpoint no
/// podía distinguir "todavía esperando" de "ya se está narrando de verdad". Arreglado con
/// `claimedAt` en `zoneContext` (ver worldTick.ts).
const findUniqueSave = vi.fn();
const deleteManyTransit = vi.fn();
const createLogEntry = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    characterTransit: { deleteMany: (...args: unknown[]) => deleteManyTransit(...args) },
    logEntry: { create: (...args: unknown[]) => createLogEntry(...args) },
  },
}));

const { sessionRoutes } = await import('./session.js');

async function buildApp() {
  const app = Fastify();
  await app.register(sessionRoutes);
  return app;
}

describe('POST /saves/:id/transit/cancel', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    deleteManyTransit.mockReset();
    createLogEntry.mockReset().mockResolvedValue({});
  });

  it('404 si no hay ningún tránsito pendiente', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Gorhorn', characterTransit: null });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/transit/cancel' });

    expect(res.statusCode).toBe(404);
    expect(deleteManyTransit).not.toHaveBeenCalled();
  });

  it('cancela un tránsito todavía sin reclamar (sin claimedAt en zoneContext)', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      characterName: 'Gorhorn',
      characterTransit: { busyUntil: new Date(Date.now() + 60_000), zoneContext: { action: 'x' } },
    });
    deleteManyTransit.mockResolvedValue({ count: 1 });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/transit/cancel' });

    expect(res.statusCode).toBe(204);
    expect(createLogEntry).toHaveBeenCalled();
  });

  it('409 si worldTick ya reclamó el tránsito (claimedAt presente) — antes esto se cancelaba igualmente, tirando la narración ya generada', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      characterName: 'Gorhorn',
      // busyUntil sigue en el futuro (worldTick lo empujó 10 min al reclamar) — el bug real era
      // que ESTO SOLO ya dejaba pasar el cancel.
      characterTransit: { busyUntil: new Date(Date.now() + 9 * 60_000), zoneContext: { action: 'x', claimedAt: new Date().toISOString() } },
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/transit/cancel' });

    expect(res.statusCode).toBe(409);
    expect(deleteManyTransit).not.toHaveBeenCalled();
    expect(createLogEntry).not.toHaveBeenCalled();
  });
});
