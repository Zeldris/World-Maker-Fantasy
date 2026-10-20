import { env } from '../config/env.js';
import { ollamaQueue } from './ollamaQueue.js';
import { calcularTruncated, nsToMs, registrarLlamada } from './iaRegistro.js';

export interface OllamaGenerateOptions {
  model: string;
  /// Si se omite, Ollama usa el SYSTEM ya cocinado en el Modelfile del modelo (recomendado:
  /// no reenviar aquí la identidad/tono/reglas del mundo en cada llamada, eso vive en el Modelfile).
  system?: string;
  prompt: string;
  /// JSON Schema opcional para pedir salida estructurada (Ollama `format`).
  /// Actualizado 2026-09-14 (docs/arquitectura/04-decisiones-tecnicas.md decisión 17): la premisa de que
  /// "Qwen2.5 es más fiable con esto que Llama" (decisión técnica 7, tomada el primer día sin
  /// medir) NO se sostuvo al probar Llama 3.1 8B Instruct en serio bajo la misma gramática GBNF —
  /// JSON siempre válido en ambos, sin ninguna ventaja real de Qwen aquí.
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
  /// Fuerza esta llamada a CPU (Ollama `num_gpu: 0`) aunque el servidor tenga la iGPU activada
  /// globalmente (roadmap 2026-07-24, hallazgo real jugando en la Steam Deck: el backend Vulkan
  /// de la iGPU AMD narraba más rápido pero con menos coherencia — un NPC de otra región
  /// apareciendo de la nada — que el mismo modelo/Modelfile en CPU). Se usa solo en las llamadas
  /// donde importa la calidad narrativa (narración, diálogo de NPC); clasificación/resúmenes
  /// siguen en GPU sin tocar, no necesitan esa precisión y sí se benefician de la velocidad.
  forceCpu?: boolean;
  /// Tarea del proyecto, solo para el registro de opt-ai (`app.task`, docs/ia/opt-ai-registro.md):
  /// `narrar`, `clasificar`, `sugerir`, `cronica`, `resumen`, `combate`, `modo_dinamico`… No cambia
  /// la petición a Ollama.
  tarea?: string;
  /// Contexto pedido a Ollama (`num_ctx`). Si se omite no se envía (manda el Modelfile); si se
  /// pasa, además de enviarse sirve para calcular `truncated` en el registro.
  numCtx?: number;
  /// Intento de la cascada del narrador (1, 2 o 3), solo para el registro (`app.intento`, QA-162).
  intento?: number;
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
    // `think: false` (encontrado probando qwen3.5:4b/9b en vivo, 2026-08-20 — "quizás será mejor
    // con el modelo 9B?"): la familia qwen3.5 es de "razonamiento" — sin esto, genera un monólogo
    // interno larguísimo (campo `thinking` de la respuesta) ANTES de la respuesta real, y se come
    // el `timeoutMs`/`maxTokens` enteros sin llegar nunca a producir el JSON pedido ("di hola" solo
    // no terminó en 90s). Inofensivo para los modelos actuales (familia qwen2.5, sin razonamiento —
    // ignoran el campo) — verificado sin regresión tras añadirlo. Sin esto, cualquier futuro cambio
    // a un modelo de razonamiento rompería en silencio con timeouts, no con un error claro.
    think: false,
    stream,
    keep_alive: options.keepAlive ?? env.ollamaKeepAlive,
    options: {
      use_mlock: true,
      num_thread: 8,
      ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.forceCpu ? { num_gpu: 0 } : {}),
      ...(options.numCtx ? { num_ctx: options.numCtx } : {}),
    },
  });
}

/// Bug real (2026-08-31): `ollamaQueue.enqueue` nunca recibía `queueTimeoutMs` explícito, así que
/// SIEMPRE usaba su default (150s) — pero `narrador.ts` (attempt2 de `narrateAction`) pide
/// `timeoutMs: 240_000` a su propio `AbortController` interno. El guard de cola (150s) disparaba
/// ANTES de que ese timeout interno más largo tuviera oportunidad de actuar de forma limpia,
/// cortando prematuramente intentos legítimos que el propio código ya decidió que podían tardar
/// más. El guard de cola es la red de seguridad ÚLTIMA (protege contra que el `AbortController`
/// interno falle en cortar la conexión, ver `ollamaQueue.ts`) — nunca debe ser más corto que el
/// propio `timeoutMs` que el caller ya pidió; +30s de margen para que el `AbortController` interno
/// tenga ocasión de disparar primero, limpio, antes de que el guard de cola lo haga por fuerza.
export function queueTimeoutFor(options: OllamaGenerateOptions): number | undefined {
  return options.timeoutMs ? options.timeoutMs + 30_000 : undefined;
}

interface OllamaRawStats {
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  done_reason?: string;
}

/// Error que ve el llamador y que se registra: el AbortError del timeout se traduce a un mensaje claro.
function traducirError(err: unknown, options: OllamaGenerateOptions): Error {
  if (err instanceof Error && err.name === 'AbortError') {
    return new Error(`Ollama no respondió en ${options.timeoutMs}ms (modelo ${options.model}) — probable cuelgue.`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

/// QA-162: `num_ctx` efectivo por modelo para el registro cuando la llamada no lo pasa (casi ninguna lo pasa, y
/// sin él no se veía ningún recorte): el `context_length` de `/api/ps` mientras el modelo está cargado o, si no,
/// el `num_ctx` del Modelfile (`/api/show`). Solo con IA_REGISTRO, en segundo plano y sin esperar: la primera
/// llamada de cada modelo puede salir sin él. Se consulta a los 4 s de empezar la llamada porque los modelos con
/// `keep_alive` 0 ya no salen en `/api/ps` al acabar.
const ctxPorModelo = new Map<string, number>();
const conEtiqueta = (model: string) => (model.includes(':') ? model : `${model}:latest`);

export function ctxEfectivo(model: string): number | undefined {
  return ctxPorModelo.get(conEtiqueta(model));
}

async function leerCtx(model: string): Promise<void> {
  const ps = (await fetch(`${env.ollamaBaseUrl}/api/ps`).then((r) => r.json())) as { models?: { name?: string; context_length?: number }[] };
  for (const m of ps.models ?? []) if (m.name && m.context_length) ctxPorModelo.set(m.name, m.context_length);
  if (ctxPorModelo.has(conEtiqueta(model))) return;
  const show = (await fetch(`${env.ollamaBaseUrl}/api/show`, { method: 'POST', body: JSON.stringify({ model }) }).then((r) => r.json())) as { parameters?: string };
  const n = Number(/(?:^|\n)num_ctx\s+(\d+)/.exec(show.parameters ?? '')?.[1]);
  if (n > 0) ctxPorModelo.set(conEtiqueta(model), n);
}

function vigilarCtx(options: OllamaGenerateOptions): void {
  if (!env.iaRegistro || options.numCtx || ctxPorModelo.has(conEtiqueta(options.model))) return;
  setTimeout(() => void leerCtx(options.model).catch(() => {}), 4_000).unref?.();
}

/// Registro opt-ai de una llamada a /api/generate (no hace nada sin IA_REGISTRO).
function registrarGenerate(
  options: OllamaGenerateOptions,
  raw: unknown,
  inicio: number,
  extra: { ttftMs?: number; error?: string } = {},
): void {
  const r = (raw ?? {}) as OllamaRawStats;
  const numCtx = options.numCtx ?? ctxEfectivo(options.model);
  registrarLlamada({
    operation: 'text_completion',
    provider: 'ollama',
    model: options.model,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    inputTokens: r.prompt_eval_count,
    outputTokens: r.eval_count,
    finishReason: extra.error ? 'error' : r.done_reason,
    task: options.tarea,
    intento: options.intento,
    numCtx,
    keepAlive: options.keepAlive ?? env.ollamaKeepAlive,
    durationMs: Date.now() - inicio,
    loadMs: nsToMs(r.load_duration),
    prefillMs: nsToMs(r.prompt_eval_duration),
    decodeMs: nsToMs(r.eval_duration),
    ttftMs: extra.ttftMs,
    truncated: calcularTruncated(r.prompt_eval_count, numCtx, (options.system?.length ?? 0) + options.prompt.length),
    error: extra.error,
  });
}

/// Llamada no-streaming a /api/generate, serializada por ollamaQueue (decisión técnica 5).
export async function ollamaGenerate(options: OllamaGenerateOptions): Promise<OllamaGenerateResult> {
  const queueTimeoutMs = queueTimeoutFor(options);
  return ollamaQueue.enqueue(async () => {
    const controller = options.timeoutMs ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
    const inicio = Date.now();
    vigilarCtx(options);

    try {
      // use_mlock/num_thread (roadmap de velocidad, 2026-07-19, revisado 2026-09-14): options.*
      // de Ollama son pass-through directo a llama.cpp por petición, sin tocar la config del
      // servicio. use_mlock ancla el modelo en RAM (no puede paginarse a disco a mitad de
      // generación — la causa raíz medida del cuello de botella real en este hardware).
      // num_thread subido de 4 a 8 (los 4 núcleos físicos con SMT de la Steam Deck) tras activar
      // la iGPU (OLLAMA_IGPU_ENABLE=1, ver docs/arquitectura/04-decisiones-tecnicas.md § 11): la decisión
      // original de fijarlo a 4 se tomó en CPU pura, donde 8 hilos SMT competían por el mismo bus
      // de RAM y empeoraban. Con la mayoría de la carga ya en GPU, la CPU solo cubre el resto
      // (offload parcial) y 8 hilos sí ayudan — medido +6% tok/s en Mistral Nemo (~8.66→~9.2
      // tok/s), sin regresión en los modelos 100% GPU (num_thread apenas importa ahí). OJO: la
      // premisa original SIGUE siendo cierta en CPU pura — re-medido el mismo día con
      // `forceCpu`/`num_gpu: 0`, thread4 (~11.3 tok/s) supera a thread8 (~10.2 tok/s). Si
      // `forceCpu` vuelve a usarse activamente (hoy nadie lo invoca), reconsiderar bajar el
      // thread count solo para esa rama.
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
      registrarGenerate(options, raw, inicio);
      return { text: raw.response, raw };
    } catch (err) {
      const traducido = traducirError(err, options);
      registrarGenerate(options, undefined, inicio, { error: traducido.message });
      throw traducido;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, queueTimeoutMs);
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
  const queueTimeoutMs = queueTimeoutFor(options);
  return ollamaQueue.enqueue(async () => {
    const controller = options.timeoutMs ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
    const inicio = Date.now();
    vigilarCtx(options);
    let ttftMs: number | undefined;

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
      let terminado = false;

      const procesarLinea = (texto: string) => {
        const line = texto.trim();
        if (!line) return;
        const parsed = JSON.parse(line) as { response?: string; done?: boolean; error?: string };
        // Ollama puede mandar `{"error": "..."}` a mitad de stream (p. ej. modelo que falla al cargar).
        if (parsed.error) {
          // Se cierra la conexión antes de lanzar: si no, Ollama sigue generando para nadie.
          void reader.cancel().catch(() => {});
          throw new Error(parsed.error);
        }
        lastRaw = parsed;
        if (parsed.done) terminado = true;
        if (parsed.response) {
          fullText += parsed.response;
          ttftMs ??= Date.now() - inicio;
          onChunk(parsed.response);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Ollama separa cada objeto NDJSON con un salto de línea — un chunk de red no tiene por
        // qué alinearse con esos límites, así que se acumula en `buffer` hasta tener línea completa.
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          procesarLinea(line);
          newlineIndex = buffer.indexOf('\n');
        }
      }
      // Última línea sin '\n' final (p. ej. el `{"done":true}`): se procesa también.
      buffer += decoder.decode();
      procesarLinea(buffer);

      registrarGenerate(options, lastRaw, inicio, { ttftMs, error: terminado ? undefined : 'stream incompleto' });
      return { text: fullText, raw: lastRaw };
    } catch (err) {
      const traducido = traducirError(err, options);
      registrarGenerate(options, undefined, inicio, { ttftMs, error: traducido.message });
      throw traducido;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, queueTimeoutMs);
}
