/// Decisión técnica 5 (docs/04-decisiones-tecnicas.md): todas las llamadas a Ollama pasan por
/// esta cola con concurrencia 1 — nunca dos generaciones a la vez, para no saturar el hardware local.
export class OllamaQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    // Absorbemos el error aquí para que un fallo no rompa la cadena de la cola;
    // el error real se sigue propagando a quien llamó a enqueue() vía `result`.
    this.tail = result.catch(() => undefined);
    return result;
  }
}

export const ollamaQueue = new OllamaQueue();

/// Cola SEPARADA solo para embeddings (roadmap de velocidad, 2026-07-19): nomic-embed-text pesa
/// 274MB y responde en ~1-2s — obligarlo a esperar detrás de una generación de 30-220s del modelo
/// grande en la misma cola de concurrencia-1 no protege nada (no compiten de verdad por RAM) y
/// solo bloquea el RAG en serie con narrar/clasificar cuando podrían solaparse.
export const embedQueue = new OllamaQueue();
