/// Genera pares DPO SINTÉTICOS (chosen=nube, rejected=modelo local) reutilizando el mismo banco de
/// escenarios que el pipeline SFT (distillationScenarios.ts) — vía paralela y aditiva a la captura
/// en vivo de liveTeacherCapture.ts (2026-09-04, "cuántos resultados acumular antes de entrenar la
/// v2" → mientras se sigue jugando y capturando en vivo, este script permite acumular pares sin
/// depender de sesiones de juego reales). Mismo destino que la captura en vivo (tabla
/// `LiveTeacherCapture`), para que `export-dpo-dataset.ts` funcione sin ningún cambio sobre ambas
/// fuentes a la vez.
///
/// Diferencia real con generate-distillation-dataset.ts (SFT): aquél solo pide una respuesta a la
/// nube y la guarda como ejemplo de imitación (`{system,user,assistant}`); este pide la MISMA
/// pregunta a la nube Y al modelo local real (`narrateAction`, el mismo código que usa producción)
/// y guarda AMBAS respuestas juntas para que el entrenamiento aprenda a preferir una sobre la otra.
///
/// Uso: npm run generate-dpo-dataset [-- --category=combate --limit=20]
/// Salida: filas nuevas en LiveTeacherCapture (worldId real del escenario, saveId sintético fijo
/// para poder distinguir estas filas de las de partidas reales sin tocar el schema).
import 'dotenv/config';
import '../lib/setupFetch.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { completeCloudOnly } from '../lib/aiProviders/orchestrator.js';
import { readModelfileSystemPrompt, buildTeacherUserContent } from '../lib/modelfileSystemPrompt.js';
import { validateSchema, runDetectors, extractJsonPayload } from './data/distillationValidation.js';
import { narrateAction, type NarrationResult } from '../services/narrador.js';
import { DISTILLATION_SCENARIOS } from './data/distillationScenarios.js';

const MAX_TOKENS = 900;
/// saveId sintético fijo (2026-09-04) — LiveTeacherCapture.saveId no tiene @relation a propósito
/// (dato de solo referencia/auditoría, ver schema.prisma), así que no hace falta un Save real: un
/// valor constante y reconocible basta para poder filtrar/excluir estas filas si algún día hiciera
/// falta distinguirlas de capturas de partidas reales.
const SYNTHETIC_SAVE_ID = 'synthetic-dpo-generator';

function parseArgs() {
  const args = process.argv.slice(2);
  const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1];
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  return { category: categoryArg, limit: limitArg ? Number(limitArg) : undefined };
}

/// Reanudación (mismo criterio que generate-distillation-dataset.ts § loadAlreadyGeneratedIds): sin
/// esto, relanzar el script tras un corte de cuota volvería a generar pares ya aceptados. El id del
/// escenario no vive en LiveTeacherCapture (no hay columna para ello) — se codifica al final de
/// `userContent` como comentario invisible al modelo (después del JSON Schema, que ya es lo último
/// que lee el profesor) para poder recuperarlo sin tocar el schema de la tabla.
const SCENARIO_MARKER_PREFIX = '\n\n<!-- scenario-id: ';

function withScenarioMarker(userContent: string, scenarioId: string): string {
  return `${userContent}${SCENARIO_MARKER_PREFIX}${scenarioId} -->`;
}

async function loadAlreadyGeneratedIds(): Promise<Set<string>> {
  const rows = await prisma.liveTeacherCapture.findMany({
    where: { saveId: SYNTHETIC_SAVE_ID },
    select: { userContent: true },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    const idx = row.userContent.lastIndexOf(SCENARIO_MARKER_PREFIX);
    if (idx === -1) continue;
    const id = row.userContent.slice(idx + SCENARIO_MARKER_PREFIX.length, -4);
    ids.add(id);
  }
  return ids;
}

async function main() {
  const { category, limit } = parseArgs();
  const systemPrompt = readModelfileSystemPrompt();
  // Mismo mundo que usan todos los escenarios de distillationScenarios.ts (worldCatalog.ts en
  // memoria no tiene noción de fila de BD real — se resuelve aquí, no ahí, mismo patrón que ya usan
  // los tests de integración de turn.ts).
  const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });

  const alreadyGenerated = await loadAlreadyGeneratedIds();

  let scenarios = DISTILLATION_SCENARIOS;
  if (category) scenarios = scenarios.filter((s) => s.category === category);
  const skipped = scenarios.filter((s) => alreadyGenerated.has(s.id)).length;
  scenarios = scenarios.filter((s) => !alreadyGenerated.has(s.id));
  if (limit) scenarios = scenarios.slice(0, limit);

  if (skipped > 0) console.log(`Reanudando: ${skipped} escenario(s) ya generados en una tanda anterior, se saltan.`);

  if (scenarios.length === 0) {
    console.log('[generate-dpo-dataset] no queda ningún escenario pendiente (todos ya generados o ninguno coincide con el filtro).');
    return;
  }

  let accepted = 0;
  let rejectedCloud = 0;
  let rejectedLocal = 0;
  const rejectionReasons: Record<string, number> = {};

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`[${i + 1}/${scenarios.length}] ${scenario.id} (${scenario.category})`);

    const userContentBase = buildTeacherUserContent(scenario.ctx);
    const userContent = withScenarioMarker(userContentBase, scenario.id);

    // Nube (chosen) — misma rotación que la captura en vivo real, nunca cae a Ollama local.
    const cloudResult = await completeCloudOnly(systemPrompt, userContentBase, MAX_TOKENS);
    if (!cloudResult) {
      console.warn('  descartado: todos los proveedores cloud fallaron o ninguno está configurado');
      rejectedCloud++;
      rejectionReasons['sin proveedor cloud disponible'] = (rejectionReasons['sin proveedor cloud disponible'] ?? 0) + 1;
      continue;
    }

    let cloudValid = false;
    let cloudRejectReason: string | null = null;
    try {
      const parsed = JSON.parse(extractJsonPayload(cloudResult.text)) as NarrationResult;
      cloudRejectReason = validateSchema(parsed, scenario.ctx) ?? runDetectors(parsed, scenario.ctx);
      cloudValid = !cloudRejectReason;
    } catch {
      cloudRejectReason = 'JSON mal formado';
    }
    if (!cloudValid) {
      console.warn(`  descartado (${cloudResult.provider}): ${cloudRejectReason}`);
      rejectedCloud++;
      rejectionReasons[cloudRejectReason!] = (rejectionReasons[cloudRejectReason!] ?? 0) + 1;
      continue;
    }

    // Local (rejected) — narrateAction real, mismo código/modelo que usa producción para narrar de
    // verdad. Si el local truena (timeout/JSON roto), se descarta el par entero: un "rejected" que
    // no es JSON válido no sirve para DPO (DPOTrainer espera dos completions bien formadas).
    let localNarration: NarrationResult;
    try {
      localNarration = await narrateAction(scenario.ctx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  descartado: el modelo local falló al narrar este escenario: ${msg}`);
      rejectedLocal++;
      rejectionReasons['modelo local falló'] = (rejectionReasons['modelo local falló'] ?? 0) + 1;
      continue;
    }

    await prisma.liveTeacherCapture.create({
      data: {
        saveId: SYNTHETIC_SAVE_ID,
        worldId: world.id,
        systemPrompt,
        userContent,
        cloudRawText: cloudResult.text,
        cloudProvider: cloudResult.provider,
        cloudValid: true,
        cloudRejectReason: null,
        localNarrationJson: localNarration as unknown as Prisma.InputJsonValue,
        localModel: env.ollamaModelNarrador,
      },
    });
    accepted++;
    console.log(`  aceptado (cloud: ${cloudResult.provider})`);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Pares DPO aceptados: ${accepted}`);
  console.log(`Descartados (nube rechazada): ${rejectedCloud}`);
  console.log(`Descartados (local falló): ${rejectedLocal}`);
  if (rejectedCloud + rejectedLocal > 0) {
    console.log('Motivos de descarte:');
    for (const [reason, count] of Object.entries(rejectionReasons)) console.log(`  - ${reason}: ${count}`);
  }
  console.log(`\nCorre "npm run export-dpo-dataset" para volcar estos pares (junto con los de captura en vivo) a backend/output/dpo-dataset/live-dpo.jsonl.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
