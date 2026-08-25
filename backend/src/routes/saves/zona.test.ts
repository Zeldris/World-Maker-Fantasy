import { describe, it, expect, vi, afterEach } from 'vitest';
import Fastify from 'fastify';

// Grupo 3 § Mundo determinista, Capa 1 (2026-08-25) — prototipo de zonas navegables. Solo Prisma
// mockeado (mismo criterio que panels.test.ts) — `zoneMapImageUrl`/`sourceDisplayNameFor` se dejan
// sin mockear a propósito para probar la integración real con el filesystem/catálogo.
const findUniqueSave = vi.fn();
const findManyNpc = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
  },
}));

const { zonaRoutes } = await import('./zona.js');

async function buildApp() {
  const app = Fastify();
  await app.register(zonaRoutes);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /saves/:id/zona', () => {
  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValueOnce(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/x/zona' });
    expect(res.statusCode).toBe(404);
  });

  it('sin currentLocation: no disponible', async () => {
    findUniqueSave.mockResolvedValueOnce({ id: 's1', worldId: 'w1', currentLocation: null });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    expect(res.json()).toEqual({ disponible: false, puntos: [] });
  });

  it('con Location pero sin ZonePoint sembrado todavía: no disponible', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1', worldId: 'w1',
      currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', zonePoints: [] },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    expect(res.json()).toEqual({ disponible: false, puntos: [] });
  });

  it('con ZonePoints reales: resuelve nombres de FAUNA/RECURSO y devuelve posiciones', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1',
      worldId: 'w1',
      currentLocation: {
        id: 'loc1',
        slug: 'hondonada-del-eco',
        name: 'La Hondonada del Eco',
        zonePoints: [
          { id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null },
          { id: 'zp2', x: 400, y: 470, tipo: 'RECURSO', targetSlug: 'yerreo', label: null },
          { id: 'zp3', x: 100, y: 100, tipo: 'FAUNA', targetSlug: 'gesgurio', label: 'Etiqueta a mano' },
        ],
      },
    });
    findManyNpc.mockResolvedValueOnce([
      { slug: 'kirelon-arenoso', name: 'Kirelon Arenoso' },
      { slug: 'gesgurio', name: 'Gesgurio' },
    ]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const body = res.json();
    expect(body.disponible).toBe(true);
    expect(body.locationSlug).toBe('hondonada-del-eco');
    expect(body.imageUrl).toBeNull(); // sin PNG real subido en este entorno de test
    expect(body.puntos).toEqual([
      { id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', nombre: 'Kirelon Arenoso' },
      { id: 'zp2', x: 400, y: 470, tipo: 'RECURSO', targetSlug: 'yerreo', nombre: expect.any(String) },
      { id: 'zp3', x: 100, y: 100, tipo: 'FAUNA', targetSlug: 'gesgurio', nombre: 'Etiqueta a mano' }, // label manda sobre el nombre real
    ]);
  });
});
