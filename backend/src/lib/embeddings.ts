import { env } from '../config/env.js';
import { embedQueue } from './ollamaQueue.js';
import { nsToMs, registrarLlamada } from './iaRegistro.js';

/// Cliente para /api/embed de Ollama (RAG del lore, ver LoreChunk en schema.prisma).
/// bge-m3 produce vectores de 1024 dimensiones (lore y hechos del mundo, QA-361/QA-523). Cola PROPIA
/// (embedQueue, roadmap de velocidad 2026-07-19) separada de classify/narrate: compartir la cola de concurrencia-1 solo
/// serializaba el RAG detrás de generaciones de 30-220s sin necesidad.
/// `modelo`: por defecto OLLAMA_MODEL_EMBEDDINGS; el lore puede usar otro (`RAG_MODELO`, `QA-351`).
export async function embed(text: string, modelo: string = env.ollamaModelEmbeddings): Promise<number[]> {
  return embedQueue.enqueue(async () => {
    // 30s: embeber nunca ha tardado más de ~2s en pruebas reales — un timeout corto aquí
    // detecta rápido si Ollama se ha quedado colgado antes de perder tiempo en clasificar/narrar.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const inicio = Date.now();
    const registrar = (raw?: { total_duration?: number; load_duration?: number; prompt_eval_count?: number }, error?: string) =>
      registrarLlamada({
        operation: 'embeddings',
        provider: 'ollama',
        model: modelo,
        inputTokens: raw?.prompt_eval_count,
        task: 'embedding',
        keepAlive: env.ollamaKeepAlive,
        durationMs: Date.now() - inicio,
        loadMs: nsToMs(raw?.load_duration),
        finishReason: error ? 'error' : undefined,
        error,
      });

    try {
      const response = await fetch(`${env.ollamaBaseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelo,
          input: text,
          // A diferencia de classifyAction, aquí NO forzamos keep_alive '0': descargarlo cada
          // vez obligaba a recargarlo desde disco en cada turno — visto en pruebas: eso sumaba
          // segundos reales de más sin necesidad. Usa el keep_alive por defecto (env.ollamaKeepAlive).
          keep_alive: env.ollamaKeepAlive,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama (embeddings) respondió ${response.status}: ${await response.text()}`);
      }

      const raw = (await response.json()) as { embeddings: number[][]; total_duration?: number; load_duration?: number; prompt_eval_count?: number };
      registrar(raw);
      return raw.embeddings[0];
    } catch (err) {
      const traducido =
        err instanceof Error && err.name === 'AbortError'
          ? new Error('Ollama (embeddings) no respondió en 30s — probable cuelgue.')
          : err instanceof Error
            ? err
            : new Error(String(err));
      registrar(undefined, traducido.message);
      throw traducido;
    } finally {
      clearTimeout(timer);
    }
  });
}

/// Formatea un vector como literal de pgvector para usar en SQL crudo: '[0.1,0.2,...]'
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
