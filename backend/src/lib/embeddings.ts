import { env } from '../config/env.js';
import { ollamaQueue } from './ollamaQueue.js';

/// Cliente para /api/embed de Ollama (RAG del lore, ver LoreChunk en schema.prisma).
/// nomic-embed-text produce vectores de 768 dimensiones. Pasa por la misma cola que las
/// generaciones normales — es un modelo aparte y no queremos que compita en RAM con el
/// modelo grande a mitad de un turno.
export async function embed(text: string): Promise<number[]> {
  return ollamaQueue.enqueue(async () => {
    // 30s: embeber nunca ha tardado más de ~2s en pruebas reales — un timeout corto aquí
    // detecta rápido si Ollama se ha quedado colgado antes de perder tiempo en clasificar/narrar.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(`${env.ollamaBaseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: env.ollamaModelEmbeddings,
          input: text,
          // A diferencia de classifyAction, aquí NO forzamos keep_alive '0': es un modelo pequeño
          // (274MB), convivir con los otros dos no supone presión real de RAM, y descargarlo cada
          // vez obligaba a recargarlo desde disco en cada turno — visto en pruebas: eso sumaba
          // segundos reales de más sin necesidad. Usa el keep_alive por defecto (env.ollamaKeepAlive).
          keep_alive: env.ollamaKeepAlive,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama (embeddings) respondió ${response.status}: ${await response.text()}`);
      }

      const raw = (await response.json()) as { embeddings: number[][] };
      return raw.embeddings[0];
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Ollama (embeddings) no respondió en 30s — probable cuelgue.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  });
}

/// Formatea un vector como literal de pgvector para usar en SQL crudo: '[0.1,0.2,...]'
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
