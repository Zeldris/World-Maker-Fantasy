import { env } from '../config/env.js';
import { ollamaGenerate } from '../lib/ollama.js';
import { prisma } from '../lib/prisma.js';

/// QA-339 (`/gw-opt-ai`, 2026-11-14): el primer turno tras arrancar tardaba 38-67 s hasta la primera palabra, frente a
/// ~12 s después, porque el calentamiento de `server.ts` solo deja en la caché de Ollama el prefijo fijo del prompt, no
/// el personaje ni los hechos de la zona. Cada narración del modelo guarda aquí su principio estable
/// (`buildNarrationPrompt#prefijoEstable`) y, al abrir la partida, se le manda a Ollama con `num_predict` 1.
///
/// Ollama guarda una sola caché de prompt por modelo cargado: se recuerda el último prefijo que vio el narrador en este
/// proceso y solo se calienta si el de la partida es otro (al arrancar, o al cambiar de partida). Así recargar la
/// página tras cada turno no repite el trabajo.
let ultimoPrefijoEnCache: string | null = null;

/// Tras narrar con el modelo: guarda el prefijo de la partida y lo da por cacheado.
export async function guardarPrefijoNarrador(saveId: string, texto: string): Promise<void> {
  ultimoPrefijoEnCache = texto;
  await prisma.prefijoNarrador.upsert({ where: { saveId }, create: { saveId, texto }, update: { texto } });
}

/// Al abrir la partida: manda su último prefijo al narrador si no es el que ya tiene en la caché. Devuelve si lo mandó.
/// No se espera ni bloquea nada: si falla, el primer turno solo pierde el ahorro.
export async function calentarNarradorDePartida(saveId: string): Promise<boolean> {
  const fila = await prisma.prefijoNarrador.findUnique({ where: { saveId }, select: { texto: true } });
  if (!fila || fila.texto === ultimoPrefijoEnCache) return false;
  ultimoPrefijoEnCache = fila.texto;
  // Mismas opciones que el intento 1 de `narrateAction` que afectan a la carga (modelo, `keep_alive`; sin `num_ctx`
  // ni `num_gpu`): una distinta recargaría el modelo.
  try {
    await ollamaGenerate({ model: env.ollamaModelNarrador, prompt: fila.texto, maxTokens: 1, timeoutMs: 120_000, keepAlive: '1h', tarea: 'calentar' });
  } catch (err) {
    ultimoPrefijoEnCache = null;
    throw err;
  }
  return true;
}

/// Solo para tests: olvida qué prefijo tiene la caché.
export function olvidarPrefijoEnCacheParaTests(): void {
  ultimoPrefijoEnCache = null;
}
