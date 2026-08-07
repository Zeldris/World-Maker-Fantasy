/// Genera el dataset de destilación para el plan "IA local propia" (2026-08-07, ver plan en
/// memoria/conversación — objetivo: fine-tuning ligero de un qwen2.5:7b propio a partir de un
/// profesor cloud más fuerte). Por cada escenario de distillationScenarios.ts, pide la misma
/// narración que pediría producción (buildNarrationPrompt, el MISMO código que usa narrador.ts) a
/// los proveedores cloud ya configurados (Mistral → SambaNova → Cerebras, en ese orden — nunca cae
/// a Ollama local: aceptar una respuesta del modelo pequeño como material de entrenamiento
/// arruinaría el propósito de destilar desde un profesor mejor). Cada respuesta pasa por los
/// MISMOS detectores deterministas que usa producción (narrador.ts) más una validación de
/// slugs/enums — solo lo que pasa todo se guarda como ejemplo de entrenamiento.
///
/// Uso: npm run generate-distillation-dataset [-- --category=combate --limit=20]
/// Salida: backend/output/distillation-dataset/<categoria>.jsonl (uno por categoría, formato
/// {messages:[{role,content},...]} — compatible con la mayoría de herramientas de fine-tuning).
import 'dotenv/config';
import '../lib/setupFetch.js';
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import path from 'node:path';

import { buildNarrationPrompt } from '../services/narrador.js';
import type { NarrationResult } from '../services/narrador.js';
import { mistralClient } from '../lib/aiProviders/mistralClient.js';
import { sambanovaClient } from '../lib/aiProviders/sambanovaClient.js';
import { cerebrasClient } from '../lib/aiProviders/cerebrasClient.js';
import { geminiClient } from '../lib/aiProviders/geminiClient.js';
import { groqClient } from '../lib/aiProviders/groqClient.js';
import { cloudflareClient } from '../lib/aiProviders/cloudflareClient.js';
import type { AiClient } from '../lib/aiProviders/aiClient.js';
import { DISTILLATION_SCENARIOS, type DistillationScenario } from './data/distillationScenarios.js';
import { validateSchema, runDetectors, extractJsonPayload } from './data/distillationValidation.js';

// Gemini primero (2026-08-07): único proveedor de la rotación con JSON forzado por schema real
// (responseSchema), no solo "modo JSON" instruido — la garantía más parecida a la gramática de
// Ollama. Groq justo después, cuota fresca todavía sin gastar hoy. Cloudflare al final, cuota
// gratuita pero modelo más débil — mejor como último recurso que como primera opción.
const TEACHER_ROTATION: AiClient[] = [geminiClient, groqClient, mistralClient, sambanovaClient, cerebrasClient, cloudflareClient];
const OUTPUT_DIR = path.resolve(import.meta.dirname, '../../output/distillation-dataset');
const MAX_TOKENS = 900;

function readModelfileSystemPrompt(): string {
  const modelfilePath = path.resolve(import.meta.dirname, '../../Modelfile');
  const content = readFileSync(modelfilePath, 'utf-8');
  const match = content.match(/SYSTEM\s+"""([\s\S]*?)"""/);
  if (!match) throw new Error('[generate-distillation-dataset] no se pudo extraer el bloque SYSTEM de backend/Modelfile');
  return match[1].trim();
}

function buildTeacherMessages(scenario: DistillationScenario, systemPrompt: string): { systemPrompt: string; userContent: string } {
  const { prompt, format } = buildNarrationPrompt(scenario.ctx);
  const userContent = `${prompt}

Responde SOLO con un JSON válido, sin texto fuera del JSON, que cumpla EXACTAMENTE este JSON Schema — los campos con "enum" solo pueden tomar uno de esos valores exactos, nunca otro distinto ni inventado:
${JSON.stringify(format, null, 2)}`;
  return { systemPrompt, userContent };
}

async function callTeachers(systemPrompt: string, userContent: string): Promise<{ text: string; provider: string } | null> {
  for (const client of TEACHER_ROTATION) {
    if (!client.disponible()) continue;
    try {
      const text = await client.complete(systemPrompt, userContent, MAX_TOKENS);
      return { text: text.trim(), provider: client.getModelId() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  [${client.getModelId()}] falló, probando siguiente proveedor: ${msg}`);
    }
  }
  return null;
}

/// Reanudación (2026-08-07, hallazgo real de la primera tanda: Mistral y SambaNova agotaron su
/// cuota gratuita a mitad de ejecución) — sin esto, relanzar el script más tarde (cuando la cuota
/// se reponga) volvería a pedir y a duplicar en el JSONL los escenarios que ya se habían aceptado
/// en una tanda anterior. Lee los IDs ya presentes en cada <categoria>.jsonl existente y los salta.
function loadAlreadyGeneratedIds(): Set<string> {
  const ids = new Set<string>();
  const categories: string[] = [...new Set(DISTILLATION_SCENARIOS.map((s) => s.category))];
  for (const category of categories) {
    const filePath = path.join(OUTPUT_DIR, `${category}.jsonl`);
    if (!existsSync(filePath)) continue;
    const lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        ids.add((JSON.parse(line) as { id: string }).id);
      } catch {
        // línea corrupta suelta — se ignora, no bloquea la reanudación del resto.
      }
    }
  }
  return ids;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1];
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  return { category: categoryArg, limit: limitArg ? Number(limitArg) : undefined };
}

async function main() {
  const { category, limit } = parseArgs();
  const systemPrompt = readModelfileSystemPrompt();

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const alreadyGenerated = loadAlreadyGeneratedIds();

  let scenarios = DISTILLATION_SCENARIOS;
  if (category) scenarios = scenarios.filter((s) => s.category === category);
  const skipped = scenarios.filter((s) => alreadyGenerated.has(s.id)).length;
  scenarios = scenarios.filter((s) => !alreadyGenerated.has(s.id));
  if (limit) scenarios = scenarios.slice(0, limit);

  if (skipped > 0) console.log(`Reanudando: ${skipped} escenario(s) ya aceptados en una tanda anterior, se saltan.`);

  if (scenarios.length === 0) {
    console.log('[generate-distillation-dataset] no queda ningún escenario pendiente (todos ya generados o ninguno coincide con el filtro).');
    return;
  }

  let accepted = 0;
  let rejected = 0;
  const rejectionReasons: Record<string, number> = {};

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`[${i + 1}/${scenarios.length}] ${scenario.id} (${scenario.category})`);

    const { userContent } = buildTeacherMessages(scenario, systemPrompt);
    const result = await callTeachers(systemPrompt, userContent);
    if (!result) {
      console.warn('  descartado: todos los proveedores cloud fallaron o ninguno está configurado');
      rejected++;
      rejectionReasons['sin proveedor disponible'] = (rejectionReasons['sin proveedor disponible'] ?? 0) + 1;
      continue;
    }

    let parsed: NarrationResult;
    try {
      parsed = JSON.parse(extractJsonPayload(result.text)) as NarrationResult;
    } catch {
      console.warn(`  descartado (${result.provider}): JSON mal formado`);
      rejected++;
      rejectionReasons['JSON mal formado'] = (rejectionReasons['JSON mal formado'] ?? 0) + 1;
      continue;
    }

    const schemaError = validateSchema(parsed, scenario);
    const detectorError = schemaError ?? runDetectors(parsed, scenario);
    if (detectorError) {
      console.warn(`  descartado (${result.provider}): ${detectorError}`);
      rejected++;
      rejectionReasons[detectorError] = (rejectionReasons[detectorError] ?? 0) + 1;
      continue;
    }

    // Se guarda el JSON ya limpio (sin el envoltorio markdown que a veces añade el profesor), no
    // el texto crudo — el objetivo es que el modelo entrenado aprenda a responder como Ollama en
    // producción (JSON puro, sin fences), no a imitar el envoltorio accidental del profesor.
    const line = JSON.stringify({
      id: scenario.id,
      category: scenario.category,
      provider: result.provider,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
        { role: 'assistant', content: JSON.stringify(parsed) },
      ],
    });
    appendFileSync(path.join(OUTPUT_DIR, `${scenario.category}.jsonl`), line + '\n', 'utf-8');
    accepted++;
    console.log(`  aceptado (${result.provider})`);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Aceptados: ${accepted}`);
  console.log(`Rechazados: ${rejected}`);
  if (rejected > 0) {
    console.log('Motivos de rechazo:');
    for (const [reason, count] of Object.entries(rejectionReasons)) console.log(`  - ${reason}: ${count}`);
  }
  console.log(`\nSalida en: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
