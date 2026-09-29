import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';

vi.mock('../lib/prisma.js', () => ({
  prisma: { $queryRaw: async () => [{ '?column?': 1 }] },
}));
vi.mock('../lib/version.js', () => ({ APP_VERSION: '9.9.9-test+abcdef0' }));

const { healthRoutes } = await import('./health.js');

async function buildApp() {
  const app = Fastify();
  await app.register(healthRoutes);
  return app;
}

describe('GET /version', () => {
  it('devuelve la versión calculada al arrancar', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/version' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ version: '9.9.9-test+abcdef0' });
  });
});

describe('GET /health', () => {
  it('incluye la versión', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true }));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.json()).toMatchObject({ status: 'ok', database: 'ok', version: '9.9.9-test+abcdef0' });
    vi.unstubAllGlobals();
  });
});
