/// Decisión técnica 5 (docs/04-decisiones-tecnicas.md): todas las llamadas a Ollama pasan por
/// esta cola con concurrencia 1 — nunca dos generaciones a la vez, para no saturar el hardware local.
class OllamaQueue {
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
