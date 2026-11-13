import 'dotenv/config';
import '../lib/setupFetch.js';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { loreChunks } from './loreChunks.js';
import { digestDelModelo } from './ragEval.js';
import {
  ESQUEMA_PREGUNTAS,
  VERSION_PROMPT,
  jsonl,
  parejasDelFragmento,
  promptGeneracion,
  repartir,
  type Descarte,
  type PreguntaGenerada,
} from './ragGenerar.js';
import type { CasoRag } from './ragEval.js';

/// Genera casos del RAG con un modelo local (`QA-331`, T3 del GVE): 2-3 preguntas por fragmento de `loreChunks.ts`,
/// en pareja es/en, sin copiar el texto del fragmento. Escribe en `backend/ia/`:
///   - `rag-casos-b.jsonl`: casos B (origen "B", no obligatorios); `rag-eval` los suma por defecto.
///   - `rag-casos-reserva.jsonl`: lote aparte (~15 %) que no se usa al ajustar el RAG.
///   - `rag-casos-a-borradores.jsonl` (con `--borradores-a N`): N parejas para que la usuaria las acepte como A
///     (origen "A", `debe_pasar: true`); las aceptadas se pasan a mano a `rag-casos.jsonl`.
///   - `rag-casos-generacion.json`: manifiesto para reproducirlo (modelo y digest, semilla, temperatura, prompt).
/// Uso: npm run rag-generar-casos -- [--modelo <m>] [--semilla 42] [--temperatura 0.7] [--borradores-a 12]
///        [--solo <n>] [--salida <dir>] (solo los n primeros fragmentos, o en otra carpeta, para probar)
/// Nada sale de partidas reales: solo del lore indexado.

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function numero(nombre: string, porDefecto: number, entero = true): number {
  const v = argumento(nombre);
  const n = v === undefined ? porDefecto : Number(v);
  if (!Number.isFinite(n) || n < 0 || (entero && !Number.isInteger(n))) {
    console.error(`${nombre} tiene que ser un número ${entero ? 'entero ' : ''}≥ 0 (recibido: ${v})`);
    process.exit(2);
  }
  return n;
}

const modelo = argumento('--modelo') ?? env.ollamaModelSugerencias;
const semilla = numero('--semilla', 42);
const temperatura = numero('--temperatura', 0.7, false);
const nA = numero('--borradores-a', 0);
const solo = argumento('--solo') === undefined ? loreChunks.length : numero('--solo', 0);
const dirSalida = argumento('--salida') ?? fileURLToPath(new URL('../../ia/', import.meta.url));
const ruta = (n: string) => join(dirSalida, n);

async function preguntasDe(prompt: string): Promise<PreguntaGenerada[]> {
  const res = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo,
      prompt,
      format: ESQUEMA_PREGUNTAS,
      stream: false,
      think: false,
      options: { seed: semilla, temperature: temperatura },
    }),
  });
  if (!res.ok) throw new Error(`Ollama respondió ${res.status}: ${await res.text()}`);
  const { response } = (await res.json()) as { response: string };
  const preguntas = (JSON.parse(response) as { preguntas?: unknown }).preguntas;
  if (!Array.isArray(preguntas)) throw new Error('la respuesta no trae `preguntas`');
  return preguntas as PreguntaGenerada[];
}

let digest: string | null = null;
try {
  digest = digestDelModelo(await (await fetch(`${env.ollamaBaseUrl}/api/tags`)).json(), modelo);
} catch {
  // Sin /api/tags el manifiesto lleva digest null.
}
if (!digest) console.error(`Aviso: sin digest de ${modelo} en /api/tags (¿Ollama simulado?).`);

const vistas = new Set<string>();
const casos: CasoRag[] = [];
const descartes: Descarte[] = [];
const fallidos: { title: string; error: string }[] = [];
const fragmentos = loreChunks.slice(0, solo);
for (const [i, f] of fragmentos.entries()) {
  try {
    const r = parejasDelFragmento(f, await preguntasDe(promptGeneracion(f)), vistas);
    casos.push(...r.casos);
    descartes.push(...r.descartes);
    console.error(`[${i + 1}/${fragmentos.length}] ${f.title}: ${r.casos.length / 2} parejas, ${r.descartes.length} descartadas`);
  } catch (err) {
    fallidos.push({ title: f.title, error: err instanceof Error ? err.message : String(err) });
    console.error(`[${i + 1}/${fragmentos.length}] ${f.title}: FALLA (${fallidos.at(-1)!.error})`);
  }
}

const { b, reserva, a } = repartir(casos, semilla, { nA });
writeFileSync(ruta('rag-casos-b.jsonl'), jsonl(b));
writeFileSync(ruta('rag-casos-reserva.jsonl'), jsonl(reserva));
if (nA > 0) writeFileSync(ruta('rag-casos-a-borradores.jsonl'), jsonl(a));

let commit: string | null = null;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  // Fuera de un repo git.
}
const manifiesto = {
  model: modelo,
  model_digest: digest,
  seed: semilla,
  temperature: temperatura,
  prompt_version: VERSION_PROMPT,
  prompt_template: promptGeneracion({ title: '{title}', text: '{text}' }),
  schema: ESQUEMA_PREGUNTAS,
  date: new Date().toISOString(),
  commit,
  counts: {
    fragments: fragmentos.length,
    failed_fragments: fallidos.length,
    discarded_questions: Object.fromEntries(
      (['copia', 'repetida', 'vacia'] as const).map((m) => [m, descartes.filter((d) => d.motivo === m).length]),
    ),
    b_cases: b.length,
    reserve_cases: reserva.length,
    a_drafts: a.length,
  },
  failed: fallidos,
  discarded: descartes,
};
writeFileSync(ruta('rag-casos-generacion.json'), JSON.stringify(manifiesto, null, 2) + '\n');

console.error(
  `Hecho: ${b.length} casos B, ${reserva.length} de reserva, ${a.length} borradores A; ` +
    `${descartes.length} preguntas descartadas, ${fallidos.length} fragmentos fallidos.`,
);
process.exit(fallidos.length === fragmentos.length ? 2 : 0);
