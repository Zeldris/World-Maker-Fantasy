import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { completeCloudOnly } from '../lib/aiProviders/orchestrator.js';
import { readModelfileSystemPrompt, buildTeacherUserContent } from '../lib/modelfileSystemPrompt.js';
import { validateSchema, runDetectors, extractJsonPayload } from '../scripts/data/distillationValidation.js';
import { buildNarrationPrompt } from './narrador.js';
import type { NarrationResult } from './narrador.js';

/// Captura en vivo de turnos reales para el pipeline DPO (plan "IA local propia", fase 2 — pares
/// de preferencia chosen/rejected, en paralelo al pipeline SFT existente de
/// generate-distillation-dataset.ts). Se dispara con `void` DESPUÉS de que el turno real ya haya
/// hecho commit y el jugador ya tenga su narración — mismo patrón que
/// `scheduleChapterSummaryGeneration` (chapterSummary.ts): nunca lanza hacia fuera, nunca bloquea
/// el turno. A diferencia de los capítulos (como mucho uno pendiente por partida), cada captura es
/// independiente — sin candado de reclamo, no hay ninguna fila compartida por la que competir.
export interface CaptureLiveTeacherExampleParams {
  saveId: string;
  worldId: string;
  ctx: Parameters<typeof buildNarrationPrompt>[0];
  localNarration: NarrationResult;
  localModel: string;
}

const MAX_TOKENS = 900;

export async function captureLiveTeacherExample(params: CaptureLiveTeacherExampleParams): Promise<void> {
  try {
    await runCapture(params);
  } catch (err) {
    console.warn(`[live-teacher-capture] fallo en segundo plano (saveId=${params.saveId}):`, err);
  }
}

async function runCapture(params: CaptureLiveTeacherExampleParams): Promise<void> {
  if (!env.liveTeacherCaptureEnabled) return;
  if (Math.random() >= env.liveTeacherCaptureSampleRate) return;

  const systemPrompt = readModelfileSystemPrompt();
  const userContent = buildTeacherUserContent(params.ctx);

  const result = await completeCloudOnly(systemPrompt, userContent, MAX_TOKENS);
  if (!result) return; // todos los proveedores cloud fallaron/sin clave — se salta este turno sin más

  let cloudValid = false;
  let cloudRejectReason: string | null = null;
  try {
    const parsed = JSON.parse(extractJsonPayload(result.text)) as NarrationResult;
    cloudRejectReason = validateSchema(parsed, params.ctx) ?? runDetectors(parsed, params.ctx);
    cloudValid = !cloudRejectReason;
  } catch {
    cloudRejectReason = 'JSON mal formado';
  }

  await prisma.liveTeacherCapture.create({
    data: {
      saveId: params.saveId,
      worldId: params.worldId,
      systemPrompt,
      userContent,
      cloudRawText: result.text,
      cloudProvider: result.provider,
      cloudValid,
      cloudRejectReason,
      localNarrationJson: params.localNarration as unknown as Prisma.InputJsonValue,
      localModel: params.localModel,
    },
  });
}
