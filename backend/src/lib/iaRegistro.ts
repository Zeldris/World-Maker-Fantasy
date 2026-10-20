import { appendFile } from 'node:fs/promises';
import { env } from '../config/env.js';

/// Registro por llamada de la skill `opt-ai` (formato: docs/ia/opt-ai-registro.md). Sin
/// `IA_REGISTRO` no hace nada. Nunca debe romper ni frenar un turno: el append es asíncrono, no se
/// espera, y cualquier error se traga con un único aviso.

export type RegistroOperacion = 'text_completion' | 'chat' | 'embeddings' | 'retrieval';

export interface RegistroLlamada {
  operation: RegistroOperacion;
  model?: string;
  provider?: string;
  maxTokens?: number;
  temperature?: number;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
  task?: string;
  numCtx?: number;
  keepAlive?: string;
  durationMs?: number;
  loadMs?: number;
  prefillMs?: number;
  decodeMs?: number;
  ttftMs?: number;
  truncated?: boolean;
  error?: string;
  ragQuery?: string;
  ragK?: number;
  ragResults?: { id: string; score: number }[];
  ragEmbedMs?: number;
  ragSearchMs?: number;
}

/// Los tiempos de Ollama vienen en nanosegundos.
export function nsToMs(ns: unknown): number | undefined {
  return typeof ns === 'number' && Number.isFinite(ns) ? Math.round((ns / 1e6) * 100) / 100 : undefined;
}

/// `input_tokens` ≥ `num_ctx` significa que el prompt se recortó. Sin ambos datos, no se sabe.
export function calcularTruncated(inputTokens?: number, numCtx?: number): boolean | undefined {
  if (inputTokens === undefined || numCtx === undefined) return undefined;
  return inputTokens >= numCtx;
}

export function lineaRegistro(r: RegistroLlamada, perfil: string, ahora = new Date()): string {
  const campos: Record<string, unknown> = {
    ts: ahora.toISOString(),
    'gen_ai.operation.name': r.operation,
    'gen_ai.provider.name': r.provider,
    'gen_ai.request.model': r.model,
    'gen_ai.request.max_tokens': r.maxTokens,
    'gen_ai.request.temperature': r.temperature,
    'gen_ai.usage.input_tokens': r.inputTokens,
    'gen_ai.usage.output_tokens': r.outputTokens,
    'gen_ai.response.finish_reason': r.finishReason,
    'app.task': r.task,
    'app.machine_profile': perfil,
    'app.num_ctx': r.numCtx,
    'app.keep_alive': r.keepAlive,
    'app.duration_ms': r.durationMs,
    'app.load_ms': r.loadMs,
    'app.prefill_ms': r.prefillMs,
    'app.decode_ms': r.decodeMs,
    'app.ttft_ms': r.ttftMs,
    'app.truncated': r.truncated,
    'app.error': r.error,
    'app.rag.query': r.ragQuery,
    'app.rag.k': r.ragK,
    'app.rag.results': r.ragResults,
    'app.rag.embed_ms': r.ragEmbedMs,
    'app.rag.search_ms': r.ragSearchMs,
  };
  for (const clave of Object.keys(campos)) {
    if (campos[clave] === undefined || campos[clave] === null) delete campos[clave];
  }
  return JSON.stringify(campos);
}

let avisado = false;

export function registrarLlamada(r: RegistroLlamada): void {
  const ruta = env.iaRegistro;
  if (!ruta) return;
  try {
    const linea = lineaRegistro(r, env.iaPerfil) + '\n';
    appendFile(ruta, linea).catch(avisar);
  } catch (err) {
    avisar(err);
  }
}

function avisar(err: unknown): void {
  if (avisado) return;
  avisado = true;
  console.warn(`[iaRegistro] no se pudo escribir en IA_REGISTRO (${env.iaRegistro}): ${err instanceof Error ? err.message : err}. Aviso único.`);
}

/// Solo para tests.
export function _reiniciarAviso(): void {
  avisado = false;
}
