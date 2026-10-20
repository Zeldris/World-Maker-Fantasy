import 'dotenv/config';
import '../lib/setupFetch.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { puestoDelPrimerEsperado, resumirCasos, type CasoRag, type ResultadoCaso } from './ragEval.js';

/// Evalúa el RAG del lore (skill opt-ai): por cada caso de `backend/ia/rag-casos.jsonl` llama a
/// `retrieveLore` y mira en qué puesto sale el primer trozo esperado.
/// Uso: npm run rag-eval -- [--casos <ruta>] [--k 5] [--json]
///
/// IDENTIFICADOR DE TROZO (`esperados`): el TÍTULO del trozo tal como está en `loreChunks.ts`
/// (`title`, texto exacto, sin distinguir mayúsculas). No vale el `id` de la tabla LoreChunk: es un
/// UUID nuevo en cada `reindex-lore`. `retrieveLore` devuelve `title`, `text` y `distance`.
/// Sale con código 1 si algún caso con `"debe_pasar": true` no sale en el top-k.

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const rutaCasos = argumento('--casos') ?? fileURLToPath(new URL('../../ia/rag-casos.jsonl', import.meta.url));
const k = Number(argumento('--k') ?? 5);
if (!Number.isInteger(k) || k <= 0) {
  console.error(`--k debe ser un entero mayor que 0 (recibido: ${argumento('--k')})`);
  process.exit(2);
}
const comoJson = process.argv.includes('--json');

const casos: CasoRag[] = readFileSync(rutaCasos, 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as CasoRag);

const { prisma } = await import('../lib/prisma.js');
const { retrieveLore } = await import('../services/retrieval.js');

const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });

const resultados: ResultadoCaso[] = [];
try {
  for (const caso of casos) {
    const trozos = await retrieveLore(caso.pregunta, world.id, k);
    const puesto = puestoDelPrimerEsperado(
      trozos.map((t) => t.title),
      caso.esperados,
    );
    resultados.push({ caso, puesto, devueltos: trozos.map((t) => t.title) });
  }
} finally {
  await prisma.$disconnect();
}

const resumen = resumirCasos(resultados, k);

if (comoJson) {
  console.log(JSON.stringify({ k, ...resumen, casos: resultados.map((r) => ({ id: r.caso.id, puesto: r.puesto, debe_pasar: r.caso.debe_pasar ?? false })) }, null, 2));
} else {
  console.log(`RAG eval — ${casos.length} casos, k=${k}, ${rutaCasos}\n`);
  for (const r of resultados) {
    const marca = r.caso.debe_pasar ? ' [debe pasar]' : '';
    console.log(`${r.caso.id.padEnd(24)} ${r.puesto === null ? 'no sale' : `puesto ${r.puesto}`}${marca}`);
  }
  console.log(`\nrecall@${k}: ${resumen.recall.toFixed(3)}   MRR: ${resumen.mrr.toFixed(3)}   fallan debe_pasar: ${resumen.fallanObligatorios.length}`);
  for (const id of resumen.fallanObligatorios) console.log(`  FALLA ${id}`);
}

process.exit(resumen.fallanObligatorios.length > 0 ? 1 : 0);
