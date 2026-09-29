import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { APP_VERSION } from '../lib/version.js';

export async function healthRoutes(app: FastifyInstance) {
  // Versionado (2026-09-29): la versión se calcula una sola vez al arrancar (lib/version.ts).
  app.get('/version', async () => ({ version: APP_VERSION }));

  app.get('/health', async () => {
    let database: 'ok' | 'error' = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
    }

    let ollama: 'ok' | 'error' = 'ok';
    try {
      const res = await fetch(`${env.ollamaBaseUrl}/api/tags`);
      if (!res.ok) ollama = 'error';
    } catch {
      ollama = 'error';
    }

    return { status: 'ok', database, ollama, version: APP_VERSION };
  });
}
