import 'dotenv/config';
import './lib/setupFetch.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { turnRoutes } from './routes/turn.js';
import { entornoRoutes } from './routes/entorno.js';
import { savesRoutes } from './routes/saves.js';
import { startWorldTickWorker, stopWorldTickWorker } from './workers/worldTick.js';

const app = Fastify({ logger: true, requestTimeout: 0 });

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(turnRoutes);
await app.register(entornoRoutes);
await app.register(savesRoutes);

app.listen({ port: env.port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

startWorldTickWorker();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    stopWorldTickWorker();
    await app.close();
    process.exit(0);
  });
}
