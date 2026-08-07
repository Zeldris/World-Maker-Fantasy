/// Consolida los <categoria>.jsonl de generate-distillation-dataset.ts en dos ficheros únicos
/// para el fine-tuning (plan "IA local propia", Fase 1→2): train.jsonl (para entrenar) y
/// eval.jsonl (~15%, held-out, NUNCA usado para entrenar — reservado para la Fase 3, comparar el
/// modelo entrenado contra el actual sobre escenarios que jamás vio en entrenamiento).
///
/// Split estratificado por categoría (no aleatorio global) para que ninguna categoría pequeña
/// (p. ej. anacronismo_bait, con solo 6 ejemplos) quede sin representación en el held-out ni
/// vaciada de training — cada categoría reserva al menos 1 ejemplo para eval si tiene 2 o más.
///
/// Uso: npm run split-distillation-dataset
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DATASET_DIR = path.resolve(import.meta.dirname, '../../output/distillation-dataset');
const EVAL_FRACTION = 0.15;

function shuffleDeterministic<T>(items: T[], seed: number): T[] {
  // Mezcla determinista (mismo seed → mismo orden siempre) — no hace falta aleatoriedad real
  // aquí, solo evitar que el split quede sesgado por el orden de generación original.
  const arr = [...items];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function main() {
  const categoryFiles = readdirSync(DATASET_DIR).filter((f) => f.endsWith('.jsonl') && f !== 'train.jsonl' && f !== 'eval.jsonl');

  const train: string[] = [];
  const evalLines: string[] = [];

  for (const file of categoryFiles) {
    const lines = readFileSync(path.join(DATASET_DIR, file), 'utf-8').split('\n').filter(Boolean);
    const shuffled = shuffleDeterministic(lines, lines.length + file.length);
    const evalCount = lines.length >= 2 ? Math.max(1, Math.round(lines.length * EVAL_FRACTION)) : 0;
    evalLines.push(...shuffled.slice(0, evalCount));
    train.push(...shuffled.slice(evalCount));
    console.log(`${file}: ${lines.length} total → ${lines.length - evalCount} train, ${evalCount} eval`);
  }

  const trainShuffled = shuffleDeterministic(train, train.length);
  const evalShuffled = shuffleDeterministic(evalLines, evalLines.length);

  writeFileSync(path.join(DATASET_DIR, 'train.jsonl'), trainShuffled.join('\n') + '\n', 'utf-8');
  writeFileSync(path.join(DATASET_DIR, 'eval.jsonl'), evalShuffled.join('\n') + '\n', 'utf-8');

  console.log(`\nTotal: ${trainShuffled.length} train, ${evalShuffled.length} eval`);
  console.log(`Escrito en: ${DATASET_DIR}/train.jsonl y ${DATASET_DIR}/eval.jsonl`);
}

main();
