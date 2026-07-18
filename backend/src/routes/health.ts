import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

export async function healthRoutes(app: FastifyInstance) {
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

    return { status: 'ok', database, ollama };
  });
}
