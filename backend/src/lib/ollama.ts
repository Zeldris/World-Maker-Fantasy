import { env } from '../config/env.js';
import { ollamaQueue } from './ollamaQueue.js';

export interface OllamaGenerateOptions {
  model: string;
  /// Si se omite, Ollama usa el SYSTEM ya cocinado en el Modelfile del modelo (recomendado:
  /// no reenviar aquí la identidad/tono/reglas del mundo en cada llamada, eso vive en el Modelfile).
  system?: string;
  prompt: string;
  /// JSON Schema opcional para pedir salida estructurada (Ollama `format`).
  /// Ver docs/03-arquitectura.md § 4.2 — Qwen2.5 es más fiable con esto que Llama, pero sigue haciendo falta validar.
  format?: object;
  /// Si se omite, usa env.ollamaKeepAlive (por defecto 5m). Pásalo a '0' para forzar que Ollama
  /// descargue el modelo de RAM en cuanto termine esta llamada — útil cuando un turno usa dos
  /// modelos distintos seguidos (clasificar con uno pequeño, narrar con el grande) y no queremos
  /// que ambos convivan en memoria a la vez en una máquina con RAM ajustada.
  keepAlive?: string;
  /// Tope duro de tokens generados (Ollama `num_predict`). No sustituye a pedir brevedad en el
  /// prompt, pero evita que una generación se descontrole en duración si el modelo lo ignora.
  maxTokens?: number;
  /// Si se omite, usa el valor por defecto del Modelfile (~0.9, pensado para prosa variada).
  /// Roadmap 2026-07-20 (mitigación de calidad narrativa, propuesta de Fable): el combate necesita
  /// precisión, no creatividad — "sangre roja y calefacción" huele a sampling demasiado caliente
  /// en un 7B Q4. Bajarlo solo para narración de combate, dejar la exploración en su temperatura normal.
  temperature?: number;
  /// Tope duro de tiempo real (ms). Visto en pruebas: a veces Ollama se queda genuinamente
  /// colgado (probablemente el motor de gramática del `format` JSON entra en bucle con ciertos
  /// prompts) y nunca responde — sin esto, setupFetch.ts desactiva TODOS los timeouts de fetch
  /// (a propósito, para no matar generaciones lentas pero legítimas), así que nada lo corta.
  /// Sin valor por defecto: cada llamada decide su propio margen según lo que ya sabe que tarda.
  timeoutMs?: number;
}

export interface OllamaGenerateResult {
  text: string;
  raw: unknown;
}

function buildRequestBody(options: OllamaGenerateOptions, stream: boolean) {
  return JSON.stringify({
    model: options.model,
    system: options.system,
    prompt: options.prompt,
    format: options.format,
    stream,
    keep_alive: options.keepAlive ?? env.ollamaKeepAlive,
    options: {
      use_mlock: true,
      num_thread: 4,
      ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    },
  });
}

/// Llamada no-streaming a /api/generate, serializada por ollamaQueue (decisión técnica 5).
export async function ollamaGenerate(options: OllamaGenerateOptions): Promise<OllamaGenerateResult> {
  return ollamaQueue.enqueue(async () => {
    const controller = options.timeoutMs ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined;

    try {
      // use_mlock/num_thread (roadmap de velocidad, 2026-07-19): options.* de Ollama son
      // pass-through directo a llama.cpp por petición, sin tocar la config del servicio.
      // use_mlock ancla el modelo en RAM (no puede paginarse a disco a mitad de generación —
      // la causa raíz medida del cuello de botella real en este hardware). num_thread fijo en
      // los 4 núcleos físicos: con carga memory-bound, dejar que Ollama detecte 8 (con
      // hyperthreading) hace que los hilos compitan por el mismo bus de RAM y empeora, no mejora.
      const response = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: buildRequestBody(options, false),
      });

      if (!response.ok) {
        throw new Error(`Ollama respondió ${response.status}: ${await response.text()}`);
      }

      const raw = (await response.json()) as { response: string };
      return { text: raw.response, raw };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama no respondió en ${options.timeoutMs}ms (modelo ${options.model}) — probable cuelgue.`);
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  });
}

/// Llamada en streaming a /api/generate (roadmap de velocidad, 2026-07-20, punto 13): Ollama
/// devuelve NDJSON (un objeto `{ response, done }` por línea, uno por token o grupo de tokens
/// generado) en vez de esperar a tenerlo todo — `onChunk` recibe cada fragmento crudo tal cual
/// llega, en el mismo orden en que el modelo lo genera. Sigue serializado por ollamaQueue como
/// `ollamaGenerate`: solo cambia CÓMO se lee la respuesta, no cuántas peticiones concurrentes
/// admite este hardware (sigue siendo una a la vez).
export async function ollamaGenerateStream(
  options: OllamaGenerateOptions,
  onChunk: (delta: string) => void,
): Promise<OllamaGenerateResult> {
  return ollamaQueue.enqueue(async () => {
    const controller = options.timeoutMs ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined;

    try {
      const response = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: buildRequestBody(options, true),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Ollama respondió ${response.status}: ${await response.text().catch(() => '')}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let lastRaw: unknown;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Ollama separa cada objeto NDJSON con un salto de línea — un chunk de red no tiene por
        // qué alinearse con esos límites, así que se acumula en `buffer` hasta tener línea completa.
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line) {
            const parsed = JSON.parse(line) as { response: string; done: boolean };
            lastRaw = parsed;
            fullText += parsed.response;
            if (parsed.response) onChunk(parsed.response);
          }
          newlineIndex = buffer.indexOf('\n');
        }
      }

      return { text: fullText, raw: lastRaw };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama no respondió en ${options.timeoutMs}ms (modelo ${options.model}) — probable cuelgue.`);
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  });
}
