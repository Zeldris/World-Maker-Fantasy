/// Validación compartida entre generate-distillation-dataset.ts (profesor cloud) y
/// compare-narrador-models.ts (Fase 3, modelo local fine-tuneado) — mismos criterios de aceptación
/// en ambos sitios, para que "pasar el filtro" signifique lo mismo al generar datos que al evaluar
/// el modelo entrenado con ellos.
import {
  hasAnachronism,
  hasEnglishLeak,
  hasFalseCombatHit,
  hasResurrectedDeadNpc,
  hasFalseTravelClaim,
  hasFalseItemUse,
  hasPrematureCombatResolution,
  isTooSimilarToLast,
} from '../../services/narrador.js';
import type { NarrationResult } from '../../services/narrador.js';
import type { DistillationScenario } from './distillationScenarios.js';

const HITO_VALUES = ['descubrimiento', 'objetivo_menor', 'objetivo_mayor'];
const CONDICION_VALUES = ['ILESO', 'HERIDO', 'GRAVE', 'INCAPACITADO', 'MUERTO'];
const QUEST_STATUS_VALUES = ['COMPLETADA', 'FALLIDA'];

/// Validación de slugs/enums — la red de seguridad que Ollama garantiza por gramática y que un
/// profesor cloud (sin esa restricción estructural) puede saltarse por pura alucinación. Esto es
/// justo lo que habría cazado el "lobo_gris" inventado en el experimento en vivo de esta sesión.
export function validateSchema(parsed: NarrationResult, scenario: DistillationScenario): string | null {
  if (typeof parsed.narration !== 'string' || parsed.narration.trim().length === 0) return 'narration ausente o vacía';
  if (!Array.isArray(parsed.newFacts)) return 'newFacts no es un array';
  const validSlugs = scenario.ctx.npcSlugsInScene ?? [];
  if (parsed.combateIniciado?.npcSlugs) {
    const invalid = parsed.combateIniciado.npcSlugs.filter((slug) => !validSlugs.includes(slug));
    if (invalid.length > 0) return `combateIniciado.npcSlugs con slug(s) inválido(s)/inventado(s): ${JSON.stringify(invalid)}`;
    if (validSlugs.length === 0) return 'combateIniciado no nulo en un escenario sin ningún NPC real en escena (alucinación de combate)';
  }
  if (parsed.hito && !HITO_VALUES.includes(parsed.hito)) return `hito con valor fuera de enum: ${parsed.hito}`;
  if (parsed.condicionFisica && !CONDICION_VALUES.includes(parsed.condicionFisica)) return `condicionFisica con valor fuera de enum: ${parsed.condicionFisica}`;
  if (parsed.questProgress?.status && !QUEST_STATUS_VALUES.includes(parsed.questProgress.status)) return `questProgress.status con valor fuera de enum: ${parsed.questProgress.status}`;
  return null;
}

/// Detectores reales de narrador.ts — las mismas funciones que protegen producción, reutilizadas
/// tal cual para puntuar al profesor o al modelo fine-tuneado. `hasFalseItemUse`/
/// `hasPrematureCombatResolution`/`isTooSimilarToLast` se sumaron aquí el 2026-08-07 (barrido de
/// ampliación del dataset) — hasta entonces protegían producción sin que el pipeline de destilación
/// los ejercitara nunca, cero cobertura de entrenamiento para esas 3 clases de bug ya cazadas
/// jugando en vivo.
export function runDetectors(parsed: NarrationResult, scenario: DistillationScenario): string | null {
  if (hasAnachronism(parsed.narration)) return 'anacronismo detectado (hasAnachronism)';
  if (hasEnglishLeak(parsed.narration)) return 'fuga de inglés detectada (hasEnglishLeak)';
  if (hasFalseCombatHit(parsed.narration, scenario.ctx.combatBothMissed)) return 'golpe narrado sin conexión mecánica (hasFalseCombatHit)';
  if (hasResurrectedDeadNpc(parsed.narration, scenario.ctx.possiblyResurrectedNpcNames)) return 'NPC muerto narrado como activo (hasResurrectedDeadNpc)';
  if (hasFalseTravelClaim(parsed, scenario.ctx.possiblyFalseTravelDestinationNames)) return 'llegada a destino ambiguo sin resolver (hasFalseTravelClaim)';
  if (hasFalseItemUse(parsed.narration, scenario.ctx.possiblyFalseItemUseNames)) return 'uso de objeto narrado sin respaldo mecánico (hasFalseItemUse)';
  if (hasPrematureCombatResolution(parsed.narration, scenario.ctx.combatNotYetResolved)) return 'combate resuelto sin intercambio mecánico (hasPrematureCombatResolution)';
  if (isTooSimilarToLast(parsed.narration, scenario.ctx.lastNarrationText)) return 'narración demasiado parecida a la anterior (isTooSimilarToLast)';
  return null;
}

/// Los proveedores cloud (y algunos modelos locales mal afinados) no siempre respetan "responde
/// SOLO con el JSON" — a veces envuelven la respuesta en un bloque de código markdown. Se limpia
/// antes de parsear en vez de contarlo como un rechazo — el CONTENIDO puede ser válido, el
/// problema es solo de envoltorio.
export function extractJsonPayload(text: string): string {
  const fenced = text.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text.trim();
}
