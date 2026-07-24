import 'dotenv/config';
import './lib/setupFetch.js';
import os from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { turnRoutes } from './routes/turn.js';
import { entornoRoutes } from './routes/entorno.js';
import { savesRoutes } from './routes/saves.js';
import { worldRoutes } from './routes/world.js';
import { startWorldTickWorker, stopWorldTickWorker } from './workers/worldTick.js';

const app = Fastify({ logger: true, requestTimeout: 0 });

// Forma de error consistente (auditoría 2026-07-22): toda ruta validada a mano devuelve
// `{ error: string }` con el código que corresponda, pero sin esto una excepción NO capturada
// (un JSON.parse roto de la salida del modelo, un error real de Prisma...) caía en el manejador
// por defecto de Fastify, que usa la forma `{ statusCode, error, message }` — el frontend solo
// mira `body.error` para mensajes al usuario, así que un 500 inesperado le llegaba con una forma
// distinta a la de cualquier 400/404 esperado. Los errores ya manejados a mano (reply.status(...)
// .send(...) dentro de cada ruta) nunca pasan por aquí — esto solo cubre lo que se escapó.
app.setErrorHandler((error: FastifyError, request, reply) => {
  request.log.error(error);
  const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
  reply.status(statusCode).send({ error: statusCode === 500 ? 'Error interno del servidor' : error.message });
});

// Aviso de RAM libre al arrancar (roadmap de velocidad, 2026-07-19): en este hardware CPU-only
// la RAM libre —no el modelo— es el cuello de botella dominante medido (docs/11: ~3GB libres
// →113-140s narrar, ~5GB libres →34s el mismo turno). Un aviso al arrancar es más barato que
// descubrirlo turno a turno jugando.
const freeGb = os.freemem() / 1024 ** 3;
if (freeGb < 5) {
  app.log.warn(`RAM libre baja al arrancar: ${freeGb.toFixed(1)}GB — narrar puede tardar mucho más de lo normal (cerrar apps ayuda).`);
}

await app.register(cors, { origin: true });
// Imágenes reales de la Enciclopedia (checklist 2026-07-21/22, punto 7 — sustituyen a los
// prompts de texto ya generados): la usuaria sube el archivo a mano a uploads/images/<tipo>/
// (ver imagePromptContext.ts para la convención de nombre), esto solo lo sirve por HTTP. Nunca
// se genera ni se borra código: es una carpeta de subida manual, como output/ pero sin
// gitignore (estos archivos no son regenerables).
await app.register(fastifyStatic, {
  root: path.resolve(import.meta.dirname, '../uploads/images'),
  prefix: '/images/',
});
await app.register(healthRoutes);
await app.register(turnRoutes);
await app.register(entornoRoutes);
await app.register(savesRoutes);
await app.register(worldRoutes);

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
