import 'dotenv/config';
import '../lib/setupFetch.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { continentForRegion, oppositeContinent } from '../lib/continent.js';
import { puestoDelPrimerEsperado, resumirCasos, type CasoRag, type ResultadoCaso } from './ragEval.js';

/// Evalúa el RAG del lore (skill opt-ai): por cada caso de `backend/ia/rag-casos.jsonl` llama a
/// `retrieveLore` y mira en qué puesto sale el primer trozo esperado.
/// Uso: npm run rag-eval -- [--casos <ruta>] [--k 4] [--json] [--registro <ruta>]
///
/// Llama a `retrieveLore` como el juego (turnResolution.ts): k=4 por defecto, y si el caso trae el campo
/// opcional `region` (p. ej. "La Cicatriz de Cristal"), la consulta lleva el sufijo ` — <región>` y se
/// excluye el lore del continente contrario (`excludeTags`), igual que en un turno real.
/// No escribe en el registro del juego: se anula `IA_REGISTRO` salvo que se pase `--registro <ruta>`.
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
const k = Number(argumento('--k') ?? 4);
if (!Number.isInteger(k) || k <= 0) {
  console.error(`--k debe ser un entero mayor que 0 (recibido: ${argumento('--k')})`);
  process.exit(2);
}
const comoJson = process.argv.includes('--json');

// `env.ts` lee IA_REGISTRO al cargarse (import dinámico, más abajo): se decide antes de cargarlo.
const rutaRegistro = argumento('--registro');
if (rutaRegistro) process.env.IA_REGISTRO = rutaRegistro;
else delete process.env.IA_REGISTRO;

const casos: CasoRag[] = readFileSync(rutaCasos, 'utf8')
  .split('\n')
  .map((texto, i) => ({ texto, linea: i + 1 }))
  .filter(({ texto }) => texto.trim())
  .map(({ texto, linea }) => {
    try {
      return JSON.parse(texto) as CasoRag;
    } catch (err) {
      console.error(`${rutaCasos}: línea ${linea} no es JSON válido (${err instanceof Error ? err.message : err})`);
      process.exit(2);
    }
  });

const { prisma } = await import('../lib/prisma.js');
const { retrieveLore } = await import('../services/retrieval.js');

const resultados: ResultadoCaso[] = [];
try {
  const world = await prisma.world.findFirst({ where: { slug: 'helek-sirik' } });
  if (!world) {
    console.error("No existe el mundo 'helek-sirik' en la base de datos: ¿falta el seed o apunta DATABASE_URL a otra base?");
    process.exit(2);
  }
  for (const caso of casos) {
    const continente = caso.region ? continentForRegion(caso.region) : null;
    const excludeTags = continente ? [oppositeContinent(continente)] : [];
    const consulta = caso.region ? `${caso.pregunta} — ${caso.region}` : caso.pregunta;
    const trozos = await retrieveLore(consulta, world.id, k, excludeTags);
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
