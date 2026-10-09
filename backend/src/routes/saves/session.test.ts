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
const deleteManyBuilding = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    characterTransit: { deleteMany: (...args: unknown[]) => deleteManyTransit(...args) },
    logEntry: { create: (...args: unknown[]) => createLogEntry(...args) },
    building: { deleteMany: (...args: unknown[]) => deleteManyBuilding(...args) },
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
    deleteManyBuilding.mockReset().mockResolvedValue({ count: 1 });
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
    expect(deleteManyBuilding).not.toHaveBeenCalled();
  });

  // Building.status EN_CONSTRUCCION real (2026-08-23, Grupo 3 § Building.status) — cancelar una
  // construcción determinista ya en marcha (turn.ts la creó EN_CONSTRUCCION al iniciar el
  // CharacterTransit) no debe dejarla huérfana en ese estado para siempre.
  it('cancelar una construcción determinista en curso borra también la fila Building EN_CONSTRUCCION', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      characterName: 'Gorhorn',
      characterTransit: {
        busyUntil: new Date(Date.now() + 60_000),
        zoneContext: { action: 'Construyo un ayuntamiento aquí mismo.', buildingId: 'building1' },
      },
    });
    deleteManyTransit.mockResolvedValue({ count: 1 });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/transit/cancel' });

    expect(res.statusCode).toBe(204);
    // Reforzado con saveId explícito (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.2, 2026-09-21) — ver
    // comentario del propio cambio en session.ts.
    expect(deleteManyBuilding).toHaveBeenCalledWith({ where: { id: 'building1', saveId: 'save1', status: 'EN_CONSTRUCCION' } });
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
    expect(deleteManyBuilding).not.toHaveBeenCalled();
  });

  // QA-27 (2026-10-09, jugando: «cancelar un viaje no va»): un viaje se reclama nada más salir por
  // la vía anticipada (`adelantada`), que no guarda nada hasta `busyUntil` — se puede cancelar.
  it('cancela un viaje reclamado por la vía anticipada (adelantada) y lo cuenta como media vuelta', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      characterName: 'Gorhorn',
      currentLocation: { name: 'El Pozo de Cauce Viejo' },
      characterTransit: {
        busyUntil: new Date(Date.now() + 60_000),
        zoneContext: { action: 'Viajo hacia La Hondonada del Eco.', travel: { minutos: 100 }, claimedAt: new Date().toISOString(), adelantada: true },
      },
    });
    deleteManyTransit.mockResolvedValue({ count: 1 });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/transit/cancel' });

    expect(res.statusCode).toBe(204);
    expect(createLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ text: 'Gorhorn da media vuelta y se queda en El Pozo de Cauce Viejo.' }) }),
    );
  });
});
