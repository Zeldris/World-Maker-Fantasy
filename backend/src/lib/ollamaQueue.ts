/// Decisión técnica 5 (docs/04-decisiones-tecnicas.md): todas las llamadas a Ollama pasan por
/// esta cola con concurrencia 1 — nunca dos generaciones a la vez, para no saturar el hardware local.
///
/// Bug real (2026-08-31, investigado tras un cuelgue reproducido jugando): el `timeoutMs`/
/// `AbortController` de `ollama.ts` vive DENTRO de cada tarea encolada — protege el `fetch` en sí,
/// pero si Ollama acepta la conexión TCP y se queda genuinamente colgado sin devolver el control
/// (motor de gramática del `format` JSON en bucle, degradación de VRAM bajo sesión larga, ambos ya
/// documentados), un `AbortSignal` no siempre logra cerrar esa conexión a tiempo del lado de
/// Node/undici — la tarea puede quedar viva mucho más allá de los 90-240s nominales. Con la cola
/// original, `this.tail` solo avanzaba cuando la tarea RESOLVÍA de verdad, así que una sola tarea
/// zombie bloqueaba TODA la cola detrás para siempre — ningún turno posterior llegaba a ejecutar,
/// y el proceso solo se recuperaba reiniciando el backend a mano. Reproducido en vivo: un turno se
/// quedó sin resolver 10+ minutos, sin ningún error en el log, hasta reiniciar Ollama Y el backend.
export class OllamaQueue {
  /// Se avanza en dos casos: cuando la tarea real termina (éxito o error) O cuando su guard de
  /// cola dispara — lo que ocurra antes. Esto es lo que permite la AUTORRECUPERACIÓN: si una tarea
  /// queda zombie, la cola avanza igualmente en cuanto expira su `queueTimeoutMs`, dejando sitio
  /// para que la SIGUIENTE tarea real (p. ej. el turno de después, ya con Ollama sano tras un
  /// reinicio externo) pueda ejecutar sin más intervención manual. La tarea zombie en sí sigue
  /// corriendo de fondo sin que nada la controle (no se puede matar un `fetch` vivo desde fuera de
  /// su propio `AbortController`) — su resultado real, si llega, simplemente no tiene ya ningún
  /// caller esperándolo.
  private tail: Promise<unknown> = Promise.resolve();

  /// `queueTimeoutMs` es una guarda de la COLA, no del `fetch` — protege contra que una tarea
  /// zombie bloquee indefinidamente a las siguientes, incluso si su propio timeout interno falla en
  /// cortar la conexión. Por defecto 150s: por encima del timeout interno más largo conocido (240s
  /// de resúmenes de capítulo se queda fuera a propósito, ver ese caller) pero sin dejar la cola
  /// real bloqueada media hora si de verdad hace falta esperar un turno legítimo lento.
  enqueue<T>(task: () => Promise<T>, queueTimeoutMs = 150_000): Promise<T> {
    const previousTail = this.tail;

    // El guard arranca cuando le toca el turno a ESTA tarea (cuando la de delante ya liberó la
    // cola, con éxito, error, o por SU PROPIO guard) — no desde el instante de `enqueue()`, para no
    // penalizar a una tarea que solo esperó su turno normal detrás de otra rápida y legítima.
    const started = previousTail.then(task, task);

    let guard: ReturnType<typeof setTimeout>;
    const guardExpired = new Promise<never>((_, reject) => {
      guard = setTimeout(() => {
        reject(new Error(`ollamaQueue: la tarea sigue sin resolver tras ${queueTimeoutMs}ms — probable cuelgue de Ollama, no bloquea la cola.`));
      }, queueTimeoutMs);
    });

    const result = Promise.race([started, guardExpired]).finally(() => clearTimeout(guard));

    // La cadena interna avanza en cuanto `result` se asienta — con éxito, con el error real de la
    // tarea, O con el timeout de cola — nunca espera indefinidamente a una tarea zombie. Esto es lo
    // que permite que la cola se autorrecupere sola tras un cuelgue, sin reiniciar el backend.
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
