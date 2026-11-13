import 'dotenv/config';
import '../lib/setupFetch.js';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { continentForRegion, oppositeContinent } from '../lib/continent.js';
import {
  consultaDelCaso,
  digestDelModelo,
  puestoDelPrimerEsperado,
  resumirCasos,
  salidaJson,
  validarCasos,
  type CasoRag,
  type ResultadoCaso,
} from './ragEval.js';

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
/// Sale con código 1 si algún caso con `"debe_pasar": true` no sale en el top-k, y con 2 si no puede evaluar.
///
/// `--json` (`QA-329`, para el GVE): un solo objeto JSON por stdout (`config`, `cases`, `summary`; forma en
/// `ragEval.ts`, `salidaJson`); cualquier otro texto va a stderr.

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

const erroresDeCasos = validarCasos(casos);
if (erroresDeCasos.length > 0) {
  console.error(`${rutaCasos}: ${erroresDeCasos.length} casos mal formados (QA-328):`);
  for (const e of erroresDeCasos) console.error(`  ${e}`);
  process.exit(2);
}

const { prisma } = await import('../lib/prisma.js');
const { retrieveLore } = await import('../services/retrieval.js');
const { env } = await import('../config/env.js');
const { configRag } = await import('../lib/ragConfig.js');

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
    const consulta = consultaDelCaso(caso);
    const trozos = await retrieveLore(consulta, world.id, k, excludeTags);
    const puesto = puestoDelPrimerEsperado(
      trozos.map((t) => t.title),
      caso.esperados,
    );
    resultados.push({ caso, puesto, consulta, devueltos: trozos.map((t) => ({ title: t.title, distance: t.distance })) });
  }
} finally {
  await prisma.$disconnect();
}

const resumen = resumirCasos(resultados, k);

/// Texto para la persona: a stdout, o a stderr si stdout es el JSON.
const informe = comoJson ? console.error : console.log;
informe(`RAG eval — ${casos.length} casos, k=${k}, ${rutaCasos}\n`);
for (const r of resultados) {
  const marca = r.caso.debe_pasar ? ' [debe pasar]' : '';
  informe(`${r.caso.id.padEnd(24)} ${r.puesto === null ? 'no sale' : `puesto ${r.puesto}`}${marca}`);
}
informe(`\nrecall@${k}: ${resumen.recall.toFixed(3)}   MRR: ${resumen.mrr.toFixed(3)}   fallan debe_pasar: ${resumen.fallanObligatorios.length}`);
for (const id of resumen.fallanObligatorios) informe(`  FALLA ${id}`);

if (comoJson) {
  const cfg = configRag();
  const raiz = git(['rev-parse', '--show-toplevel']);
  const salida = salidaJson(
    {
      embedding_model: env.ollamaModelEmbeddings,
      embedding_digest: await digestDeOllama(env.ollamaBaseUrl, env.ollamaModelEmbeddings),
      top_k: k,
      chunk_size: cfg.tamTrozo,
      chunk_overlap: cfg.solape,
      query_prefix: cfg.prefijoConsulta,
      document_prefix: cfg.prefijoDocumento,
      document_template: cfg.plantilla,
      query_template: { sin_region: '{pregunta}', con_region: '{pregunta} — {region}' },
      region_filter: 'si el caso trae región, se excluye el lore del continente contrario',
      index: null,
      index_matches: null,
      commit: git(['rev-parse', 'HEAD']),
      commit_dirty: git(['status', '--porcelain']) === null ? null : git(['status', '--porcelain']) !== '',
      cases_file: raiz ? relative(raiz, rutaCasos) : rutaCasos,
    },
    resultados,
    k,
  );
  // Con `process.exit` justo después, una tubería podría quedarse con el JSON a medias: se espera a vaciarlo.
  await new Promise<void>((hecho) => process.stdout.write(`${JSON.stringify(salida, null, 2)}\n`, () => hecho()));
}

/// Salida de una orden de git, o null si no hay git o no es un repositorio.
function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/// Digest del modelo de embeddings según `/api/tags` de Ollama; null si no lo da o no responde.
async function digestDeOllama(base: string, modelo: string): Promise<string | null> {
  try {
    const res = await fetch(`${base}/api/tags`);
    return res.ok ? digestDelModelo(await res.json(), modelo) : null;
  } catch {
    return null;
  }
}

process.exit(resumen.fallanObligatorios.length > 0 ? 1 : 0);
