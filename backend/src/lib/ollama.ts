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

/// Llamada no-streaming a /api/generate, serializada por ollamaQueue (decisión técnica 5).
/// El streaming real (para el efecto "escribiendo..." del frontend) se añadirá cuando se construyan
/// las rutas de turno — este cliente es la base sobre la que montarlo.
export async function ollamaGenerate(options: OllamaGenerateOptions): Promise<OllamaGenerateResult> {
  return ollamaQueue.enqueue(async () => {
    const controller = options.timeoutMs ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined;

    try {
      const response = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: JSON.stringify({
          model: options.model,
          system: options.system,
          prompt: options.prompt,
          format: options.format,
          stream: false,
          keep_alive: options.keepAlive ?? env.ollamaKeepAlive,
          options: options.maxTokens ? { num_predict: options.maxTokens } : undefined,
        }),
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
