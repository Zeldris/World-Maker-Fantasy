import { env } from '../config/env.js';
import { cacheEmpiezaPor, ollamaGenerate } from '../lib/ollama.js';
import { prisma } from '../lib/prisma.js';
import { isTurnInFlight } from './turnLock.js';

/// QA-339 (`/gw-opt-ai`, 2026-11-14): el primer turno tras arrancar tardaba 38-67 s hasta la primera palabra, frente a
/// ~12 s después, porque el calentamiento de `server.ts` solo deja en la caché de Ollama el prefijo fijo del prompt, no
/// el personaje ni los hechos de la zona. Cada narración del modelo guarda aquí su principio estable
/// (`buildNarrationPrompt#prefijoEstable`) y, al abrir la partida, se le manda a Ollama con `num_predict` 1.
///
/// Se calienta siempre al abrir la partida (si la caché de Ollama aún tiene el prefijo, cuesta poco): recordar el
/// último prefijo visto se quedaba viejo con otras llamadas al mismo modelo, reintentos o `keep_alive` caducado. Para
/// no saturar la cola de Ollama, no se calienta si hay un turno en curso de esa partida (el sondeo de reconexión llama
/// a GET /saves/:id a mitad de la narración) ni se repite el de la misma partida dentro de `INTERVALO_CALENTAR_MS`.
export const INTERVALO_CALENTAR_MS = 3 * 60_000;
const ultimoCalentamientoPorPartida = new Map<string, number>();

/// Regla pura: ¿toca calentar esta partida ahora?
export function tocaCalentar(saveId: string, ahora = Date.now()): boolean {
  if (isTurnInFlight(saveId)) return false;
  const ultimo = ultimoCalentamientoPorPartida.get(saveId);
  return ultimo === undefined || ahora - ultimo >= INTERVALO_CALENTAR_MS;
}

/// Tras narrar con el modelo: guarda el prefijo de la partida; la caché ya está caliente, así que no hace falta
/// calentarla al recargar.
export async function guardarPrefijoNarrador(saveId: string, texto: string): Promise<void> {
  ultimoCalentamientoPorPartida.set(saveId, Date.now());
  prefijoPorPartida.set(saveId, texto);
  await prisma.prefijoNarrador.upsert({ where: { saveId }, create: { saveId, texto }, update: { texto } });
}

/// Al abrir la partida: manda su último prefijo al narrador. Devuelve si lo mandó.
/// No se espera ni bloquea nada: si falla, el primer turno solo pierde el ahorro.
export async function calentarNarradorDePartida(saveId: string): Promise<boolean> {
  if (!tocaCalentar(saveId)) return false;
  const fila = await prisma.prefijoNarrador.findUnique({ where: { saveId }, select: { texto: true } });
  if (!fila) return false;
  ultimoCalentamientoPorPartida.set(saveId, Date.now());
  // Mismas opciones que el intento 1 de `narrateAction` que afectan a la carga (modelo, `keep_alive`; sin `num_ctx`
  // ni `num_gpu`): una distinta recargaría el modelo.
  try {
    await ollamaGenerate({ model: env.ollamaModelNarrador, prompt: fila.texto, maxTokens: 1, timeoutMs: 120_000, keepAlive: '1h', tarea: 'calentar' });
  } catch (err) {
    ultimoCalentamientoPorPartida.delete(saveId);
    throw err;
  }
  return true;
}

/// QA-514 (`/gw-opt-ai` de la ronda local 2): Ollama tiene una sola caché de prefijo por modelo, y `dialogo_npc`,
/// `modo_dinamico` y `resumen` usan el del narrador: el `narrar` siguiente salía con 0 caracteres reaprovechados y
/// 24-58 s de prefill (10-12 s con caché). Al acabar un turno (o una vuelta del modo dinámico, o un resumen), si la
/// última petición a ese modelo no empezaba por el prefijo estable de la partida, se le vuelve a mandar en segundo
/// plano. El turno siguiente de la partida lo cancela al empezar (`cancelarRecalentado`): una réplica rápida no
/// espera a un calentamiento que su propia llamada iba a pisar.
/// En memoria además de en la base: `guardarPrefijoNarrador` no se espera, y al soltar el turno puede no haber escrito.
const prefijoPorPartida = new Map<string, string>();
const recalentadoEnCurso = new Map<string, AbortController>();

/// Devuelve si lo mandó. No lanza: si falla o se cancela, el turno siguiente solo pierde el ahorro.
export async function recalentarSiDesalojado(saveId: string): Promise<boolean> {
  if (isTurnInFlight(saveId) || recalentadoEnCurso.has(saveId)) return false;
  const texto =
    prefijoPorPartida.get(saveId) ??
    (await prisma.prefijoNarrador.findUnique({ where: { saveId }, select: { texto: true } }).catch(() => null))?.texto;
  if (!texto || cacheEmpiezaPor(env.ollamaModelNarrador, texto) || isTurnInFlight(saveId)) return false;
  const controller = new AbortController();
  recalentadoEnCurso.set(saveId, controller);
  ultimoCalentamientoPorPartida.set(saveId, Date.now());
  try {
    await ollamaGenerate({ model: env.ollamaModelNarrador, prompt: texto, maxTokens: 1, timeoutMs: 120_000, keepAlive: '1h', tarea: 'recalentar', signal: controller.signal });
    return true;
  } catch (err) {
    if (!controller.signal.aborted) console.warn(`[narrador] no se recalentó el prefijo (saveId=${saveId}): ${err instanceof Error ? err.message : err}`);
    return false;
  } finally {
    if (recalentadoEnCurso.get(saveId) === controller) recalentadoEnCurso.delete(saveId);
  }
}

/// Al empezar un turno de la partida: corta su recalentado en la cola o en curso.
export function cancelarRecalentado(saveId: string): void {
  recalentadoEnCurso.get(saveId)?.abort();
  recalentadoEnCurso.delete(saveId);
}

/// Solo para tests: olvida los calentamientos recientes.
export function olvidarPrefijoEnCacheParaTests(): void {
  ultimoCalentamientoPorPartida.clear();
  prefijoPorPartida.clear();
  recalentadoEnCurso.clear();
}
