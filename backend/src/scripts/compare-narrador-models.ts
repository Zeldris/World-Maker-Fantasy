/// Fase 3 del plan "IA local propia" (2026-08-07) — compara el modelo actual en producción
/// (tarkor-narrador) contra un candidato fine-tuneado (p. ej. tarkor-narrador-v2) sobre los
/// escenarios HELD-OUT de eval.jsonl (nunca vistos en entrenamiento, ver split-distillation-dataset.ts).
/// Cada escenario se re-narra desde cero con buildNarrationPrompt (el MISMO código de producción)
/// contra ambos modelos vía Ollama, y se puntúa con los MISMOS detectores + validación de
/// enums/slugs que usa generate-distillation-dataset.ts — "pasar" significa lo mismo en los dos
/// sitios.
///
/// Uso: npm run compare-narrador-models [-- --current=tarkor-narrador --candidate=tarkor-narrador-v2]
/// El candidato no tiene por qué existir todavía en Ollama — si falta, sus llamadas fallan una a
/// una (se cuentan como fallo de ese escenario, "modelo no encontrado") sin abortar la comparación
/// completa, así este script puede lanzarse tal cual en cuanto `ollama create` termine.
import 'dotenv/config';
import '../lib/setupFetch.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { buildNarrationPrompt } from '../services/narrador.js';
import type { NarrationResult } from '../services/narrador.js';
import { ollamaGenerate } from '../lib/ollama.js';
import { env } from '../config/env.js';
import { DISTILLATION_SCENARIOS, type DistillationScenario } from './data/distillationScenarios.js';
import { validateSchema, runDetectors, extractJsonPayload } from './data/distillationValidation.js';

const DATASET_DIR = path.resolve(import.meta.dirname, '../../output/distillation-dataset');
const MAX_TOKENS = 900;
const TIMEOUT_MS = 180_000;

interface ModelResult {
  ok: boolean;
  latencyMs: number;
  reason?: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const current = args.find((a) => a.startsWith('--current='))?.split('=')[1] ?? env.ollamaModelNarrador;
  const candidate = args.find((a) => a.startsWith('--candidate='))?.split('=')[1] ?? 'tarkor-narrador-v2';
  return { current, candidate };
}

function loadHeldOutScenarioIds(): Set<string> {
  const lines = readFileSync(path.join(DATASET_DIR, 'eval.jsonl'), 'utf-8').split('\n').filter(Boolean);
  return new Set(lines.map((line) => (JSON.parse(line) as { id: string }).id));
}

async function runModel(model: string, scenario: DistillationScenario, prompt: string, format: Record<string, unknown>): Promise<ModelResult> {
  const t0 = Date.now();
  try {
    const { text } = await ollamaGenerate({ model, prompt, format, maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS, keepAlive: '1h', tarea: 'narrar' });
    const latencyMs = Date.now() - t0;
    let parsed: NarrationResult;
    try {
      parsed = JSON.parse(extractJsonPayload(text)) as NarrationResult;
    } catch {
      return { ok: false, latencyMs, reason: 'JSON mal formado' };
    }
    const error = validateSchema(parsed, scenario.ctx) ?? runDetectors(parsed, scenario.ctx);
    return error ? { ok: false, latencyMs, reason: error } : { ok: true, latencyMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, latencyMs: Date.now() - t0, reason: `error de Ollama: ${msg}` };
  }
}

interface ModelStats {
  passed: number;
  total: number;
  totalLatencyMs: number;
  failures: { id: string; reason: string }[];
}

function emptyStats(): ModelStats {
  return { passed: 0, total: 0, totalLatencyMs: 0, failures: [] };
}

function record(stats: ModelStats, id: string, result: ModelResult) {
  stats.total++;
  stats.totalLatencyMs += result.latencyMs;
  if (result.ok) stats.passed++;
  else stats.failures.push({ id, reason: result.reason ?? 'desconocido' });
}

function printStats(label: string, stats: ModelStats) {
  const avgLatency = stats.total > 0 ? (stats.totalLatencyMs / stats.total / 1000).toFixed(1) : '-';
  console.log(`\n=== ${label} ===`);
  console.log(`Pasan detectores: ${stats.passed}/${stats.total}`);
  console.log(`Latencia media: ${avgLatency}s`);
  if (stats.failures.length > 0) {
    console.log('Fallos:');
    for (const f of stats.failures) console.log(`  - ${f.id}: ${f.reason}`);
  }
}

async function main() {
  const { current, candidate } = parseArgs();
  const heldOutIds = loadHeldOutScenarioIds();
  const scenarios = DISTILLATION_SCENARIOS.filter((s) => heldOutIds.has(s.id));

  if (scenarios.length === 0) {
    console.log('[compare-narrador-models] eval.jsonl no tiene ningún escenario reconocible — ¿se regeneró distillationScenarios.ts después del split?');
    return;
  }

  console.log(`Comparando "${current}" (actual) vs "${candidate}" (candidato) sobre ${scenarios.length} escenarios held-out.\n`);

  const currentStats = emptyStats();
  const candidateStats = emptyStats();

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`[${i + 1}/${scenarios.length}] ${scenario.id} (${scenario.category})`);
    const { prompt, format } = buildNarrationPrompt(scenario.ctx);

    const currentResult = await runModel(current, scenario, prompt, format);
    record(currentStats, scenario.id, currentResult);
    console.log(`  ${current}: ${currentResult.ok ? 'OK' : `FALLO (${currentResult.reason})`} — ${(currentResult.latencyMs / 1000).toFixed(1)}s`);

    const candidateResult = await runModel(candidate, scenario, prompt, format);
    record(candidateStats, scenario.id, candidateResult);
    console.log(`  ${candidate}: ${candidateResult.ok ? 'OK' : `FALLO (${candidateResult.reason})`} — ${(candidateResult.latencyMs / 1000).toFixed(1)}s`);
  }

  printStats(`Actual: ${current}`, currentStats);
  printStats(`Candidato: ${candidate}`, candidateStats);

  // Barrera de despliegue (ver plan, Fase 3): una regresión nueva en una categoría grave
  // (anacronismo, resucitar NPC) en un escenario donde el actual sí pasaba bloquea el cambio,
  // aunque la media global del candidato sea mejor.
  const regressions = scenarios.filter((s) => {
    const wasOkInCurrent = !currentStats.failures.some((f) => f.id === s.id);
    const failsInCandidate = candidateStats.failures.some((f) => f.id === s.id);
    return wasOkInCurrent && failsInCandidate;
  });

  console.log(`\n=== Veredicto ===`);
  if (regressions.length > 0) {
    console.log(`❌ BLOQUEADO: ${regressions.length} escenario(s) que el actual narraba bien y el candidato ya no: ${regressions.map((s) => s.id).join(', ')}`);
    console.log('No cambies OLLAMA_MODEL_NARRADOR todavía, aunque la media global mejore.');
  } else if (candidateStats.passed > currentStats.passed) {
    console.log(`✅ El candidato mejora (${candidateStats.passed}/${candidateStats.total} vs ${currentStats.passed}/${currentStats.total}) sin regresiones nuevas.`);
    console.log(`Para desplegarlo: añade OLLAMA_MODEL_NARRADOR="${candidate}" a backend/.env y reinicia el backend.`);
  } else {
    console.log('Sin mejora clara todavía — revisa los fallos de arriba antes de desplegar.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
