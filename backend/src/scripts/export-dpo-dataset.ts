import 'dotenv/config';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { extractJsonPayload } from './data/distillationValidation.js';

/// Exporta las filas de LiveTeacherCapture ya validadas (cloudValid=true) y sin exportar todavía a
/// un .jsonl en formato DPO conversacional (prompt/chosen/rejected, cada uno una lista de mensajes
/// {role,content} — el formato que aceptan los notebooks DPO de Unsloth vía TRL DPOTrainer). Marca
/// `exportedAt` tras un export con éxito para que reejecutar el script no duplique filas ni líneas
/// (mismo criterio de idempotencia que `loadAlreadyGeneratedIds` en generate-distillation-dataset.ts).
///
/// Uso: npm run export-dpo-dataset
/// Salida: backend/output/dpo-dataset/live-dpo.jsonl (se añade, nunca se sobrescribe — acumula
/// entre sesiones de juego).
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../../output/dpo-dataset/live-dpo.jsonl');

async function main() {
  const rows = await prisma.liveTeacherCapture.findMany({
    where: { cloudValid: true, exportedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  if (rows.length === 0) {
    console.log('No hay filas nuevas para exportar (todo lo válido ya se exportó, o no hay ninguna captura todavía).');
    return;
  }

  const lines = rows.map((row) => {
    const cleanCloudJson = JSON.stringify(JSON.parse(extractJsonPayload(row.cloudRawText)));
    const cleanLocalJson = JSON.stringify(row.localNarrationJson);
    return JSON.stringify({
      id: row.id,
      provider: row.cloudProvider,
      prompt: [
        { role: 'system', content: row.systemPrompt },
        { role: 'user', content: row.userContent },
      ],
      chosen: [{ role: 'assistant', content: cleanCloudJson }],
      rejected: [{ role: 'assistant', content: cleanLocalJson }],
    });
  });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await appendFile(OUTPUT_PATH, lines.join('\n') + '\n', 'utf-8');

  await prisma.liveTeacherCapture.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { exportedAt: new Date() },
  });

  console.log(`Exportadas ${rows.length} fila(s) DPO a ${OUTPUT_PATH}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
