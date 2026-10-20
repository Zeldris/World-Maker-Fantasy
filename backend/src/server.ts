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
import { factionRelationsRoutes } from './routes/factionRelations.js';
import { startWorldTickWorker, stopWorldTickWorker } from './workers/worldTick.js';
import { prisma } from './lib/prisma.js';
import { registrarAvanceTrasAcciones } from './services/avanceDiario.js';
import { ollamaGenerate } from './lib/ollama.js';
import { ambitoTurnoIa } from './lib/iaRegistro.js';
import { narratorWarmupPrompt } from './services/narrador.js';

const app = Fastify({ logger: true, requestTimeout: 0 });

// QA-162: ámbito propio por petición para el id de turno del registro de `opt-ai` (ver iaRegistro.ts).
app.addHook('onRequest', (_request, _reply, done) => ambitoTurnoIa(done));

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

// QA-160 (`/opt-ai` del 2026-10-20, propuesta 9): la captura manda turnos a proveedores remotos y el
// registro de la IA no la recoge; que se vea al arrancar, porque choca con «solo local».
if (env.liveTeacherCaptureEnabled) {
  app.log.warn('LIVE_TEACHER_CAPTURE_ENABLED=true: se mandan turnos a proveedores remotos (privacidad). Las tandas de pruebas la apagan.');
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
// CR-7 (hito 0.2): acciones que mueven el reloj fuera del turno también avanzan el mundo de la partida.
registrarAvanceTrasAcciones(app, prisma);
await app.register(turnRoutes);
await app.register(entornoRoutes);
await app.register(savesRoutes);
await app.register(worldRoutes);
await app.register(factionRelationsRoutes);

app.listen({ port: env.port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

startWorldTickWorker();

// Warm-up del narrador (2026-09-14, petición explícita de Álvaro tras medir en vivo que el primer
// turno tras cada arranque tarda 2-3x más que uno en caliente). Dispara una generación mínima al
// narrador justo al arrancar, sin esperarla (`void`, nunca bloquea el arranque del servidor) ni que
// un fallo la haga ruidosa (Ollama podría no estar arriba todavía si se arrancó a la vez) — el
// primer turno real de la jugadora sigue funcionando igual si esto falla, solo pierde el ahorro.
//
// CRÍTICO — usar el prompt REAL (`narratorWarmupPrompt`), no un texto cualquiera (revisado en vivo
// el mismo día, Álvaro señaló correctamente que "cargado en GPU" no bastaba): Ollama/llama.cpp
// cachea el KV-cache por coincidencia EXACTA de prefijo de tokens, y el coste real que un warm-up
// genérico no evita es `prompt_eval_duration` (~6.7s para reprocesar el prefijo fijo de ~900
// tokens desde cero), invisible en `ollama ps`/`load_duration` — esos solo confirman que los pesos
// están en GPU, no que el prompt esté cacheado. Medido: con el prefijo real ya calentado aquí, esa
// misma parte baja a ~0.5s en el siguiente turno que la comparta (que es el 100% de los turnos
// reales, ver comentario de `narratorWarmupPrompt` en narrador.ts).
//
// `keepAlive` 1h como los turnos (QA-161): con el de por defecto (5m), si el primer turno tardaba más en llegar, se
// recargaba entero.
//
// Solo el narrador, NO el cronista (probado y descartado, 2026-09-14, cuando clasificar llevaba `keepAlive: '0'`).
// Desde QA-168 clasificar lo mantiene 5 min, así que solo el primer clasificar tras arrancar sale en frío (~7 s);
// precalentarlo tampoco ahorraría mucho si el primer turno tarda más de 5 min en llegar.
void ollamaGenerate({ model: env.ollamaModelNarrador, prompt: narratorWarmupPrompt(), maxTokens: 1, timeoutMs: 60_000, keepAlive: '1h', tarea: 'calentar' })
  .then(() => app.log.info(`Narrador (${env.ollamaModelNarrador}) precalentado en Ollama (prefijo real cacheado).`))
  .catch((err) => app.log.warn(`Warm-up del narrador falló (no bloquea el arranque): ${err instanceof Error ? err.message : err}`));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    stopWorldTickWorker();
    await app.close();
    process.exit(0);
  });
}
