import 'dotenv/config';
import '../lib/setupFetch.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { continentForRegion, oppositeContinent } from '../lib/continent.js';
import type { RetrievedLore } from '../services/retrieval.js';
import {
  consultaDelCaso,
  FORMA_CONSULTA,
  digestDelModelo,
  puestoDelPrimerEsperado,
  resumirCasos,
  salidaJson,
  validarCasos,
  validarParejas,
  type CasoRag,
  type ResultadoCaso,
} from './ragEval.js';
import {
  aplicarArgumentosRag,
  configRag,
  diferenciasDeIndice,
  hashDelIndice,
  RRF_K,
  textoConsulta,
  type ConfigIndice,
  type ConfigRag,
} from '../lib/ragConfig.js';
import {
  buscarEnMemoria,
  diferenciasDeCabecera,
  filasDelIndice,
  fusionarConsultas,
  hashDeCache,
  leerCache,
  ordenarCache,
  serializarCache,
  type CabeceraCache,
  type CacheRag,
} from './ragCache.js';

/// Evalúa el RAG del lore (skill opt-ai): por cada caso de `backend/ia/rag-casos.jsonl` llama a
/// `retrieveLore` y mira en qué puesto sale el primer trozo esperado.
/// Uso: npm run rag-eval -- [--casos <ruta>[,<ruta>…]] [--k 4] [--json] [--registro <ruta>] [--ignorar-indice]
///        [mandos del RAG: --tam-trozo, --solape, --prefijo-consulta, --prefijo-documento, --plantilla, --prefijos-nomic,
///         --modelo <nombre de Ollama>, --hibrida] [--grabar-cache <ruta.jsonl>] [--sin-red <ruta.jsonl>]
///
/// Mandos (`QA-330`, también por variables RAG_*; ver `src/lib/ragConfig.ts`): los mismos que `reindex-lore`. Si no
/// casan con los que guardó el último reindexado (`World.loreIndice`), sale con 2 diciendo cuáles, salvo con
/// `--ignorar-indice` (p. ej. para probar otro prefijo de consulta sin reindexar). Sin índice guardado, solo avisa.
/// `--hibrida` (`QA-351`) no es del índice: no se compara, pero pide que el índice tenga texto completo (sale con 2 si no).
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
/// Sin red (`QA-358`, T9 del GVE): `--grabar-cache <ruta.jsonl>`, tras la corrida normal (con Ollama y la base), escribe
/// una caché con el índice (un vector por trozo, de `loreChunks.ts` con la misma configuración que el índice, re-embebido
/// con Ollama) y el vector de la consulta de cada caso usado (formato en `ragCache.ts`). Antes comprueba que esas filas
/// den el `indice_hash` guardado en la base: si no, sale con 2. El orden de la caché es fijo: trozos por título y
/// luego por texto, consultas por texto; los títulos van en el orden de la base (`SELECT DISTINCT title … ORDER BY title`,
/// su collation, no el orden de código de JS), porque la posición del título en la caché es el desempate de la búsqueda
/// en memoria, igual que `ORDER BY distance, title` en la base. Si el archivo ya existe y su cabecera casa (mismo
/// `indice_hash`, modelo, prefijos, plantilla, trozo, solape), AÑADE las consultas nuevas y reescribe todo en el orden
/// fijo (así una caché sirve para varios archivos de casos, corridos por separado); si no casa, sale con 2.
/// `--sin-red <ruta.jsonl>` no llama a Ollama ni a la base: busca en memoria (distancia coseno como pgvector) con el
/// índice y las consultas de la caché. Si falta el vector de una consulta, sale con 2 diciendo su texto exacto. Los mandos
/// de la corrida tienen que casar con la cabecera (como con el índice de la base; `--ignorar-indice` también). No admite
/// `--hibrida` ni `--narrar` (la caché no lleva texto completo ni el texto de los trozos). `config.indice` es `vivo`
/// (base) o `congelado` (caché), y `config.cache_hash` el sha256 del archivo de la caché (null con la base).
///
/// Banco de narración (`QA-359`, T10 del GVE): `--narrar [--semilla <n>]` (semilla 42 por defecto), tras recuperar cada
/// caso, arma el prompt del narrador como el juego (`buildNarrationPrompt`, con el lore recuperado como CONOCIMIENTO DE
/// FONDO y, si el primer trozo está lejos, `weaklyGrounded`), SIN hechos de escena ni resumen del personaje (como el
/// calentamiento `narratorWarmupPrompt`), y genera con `ollamaGenerate` como el intento 1 de `narrateAction` (modelo
/// `OLLAMA_MODEL_NARRADOR`, JSON pedido, 300 tokens, `keepAlive` 1h) pero con temperatura 0 y esa semilla. El JSON añade
/// `narracion` por caso y `config.narrador`; sin `--narrar`, nada de eso. Necesita el texto de los trozos: sale con 2 con
/// `--sin-red`.
///
/// Mandos del narrador (`QA-360`, T11 del GVE; solo con `--narrar`, sin él salen con 2; sin ellos, el prompt es el de `QA-359`
/// byte a byte): `--lore-trozo` pone en el bloque de lore el TROZO recuperado (el de la fila más cercana de ese título,
/// reconstruido de `loreChunks.ts` y embebido aquí, sin plantilla ni prefijo) y no el fragmento entero (la recuperación
/// no cambia); `--max-lore-chars <n>` cambia el tope de 1400 caracteres del lore; `--lore-al-final` quita el bloque
/// de su sitio y lo pone justo antes de «ACCIÓN DEL JUGADOR:», con «Usa este lore si es pertinente.» detrás;
/// `--umbral-anclado <x>` cambia el umbral de distancia (0,75) de `weaklyGrounded`. En `config.narrador`: `lore_trozo` y
/// `lore_al_final` valen true o null (no usado), `umbral_anclado` el valor o null, y `max_lore_chars` el tope efectivo.
///
/// `--json` (`QA-329`, para el GVE): un solo objeto JSON por stdout (`config`, `indice_hash`, `casos`, `resumen`;
/// forma en `ragEval.ts`, `salidaJson`; `indice_hash` lo guarda `reindex-lore` en `World.loreIndice`); cualquier otro texto va a stderr.

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// `--casos a.jsonl,b.jsonl` (`QA-331`); por defecto, los casos a mano y, si existen, los generados (origen B).
const casosPorDefecto = ['../../ia/rag-casos.jsonl', '../../ia/rag-casos-b.jsonl']
  .map((r) => fileURLToPath(new URL(r, import.meta.url)))
  .filter((r, i) => i === 0 || existsSync(r));
const rutasCasos = argumento('--casos')?.split(',').map((r) => r.trim()).filter(Boolean) ?? casosPorDefecto;
const rutaCasos = rutasCasos.join(',');
const k = Number(argumento('--k') ?? 4);
if (!Number.isInteger(k) || k <= 0) {
  console.error(`--k debe ser un entero mayor que 0 (recibido: ${argumento('--k')})`);
  process.exit(2);
}
const comoJson = process.argv.includes('--json');
const ignorarIndice = process.argv.includes('--ignorar-indice');
const rutaGrabarCache = argumento('--grabar-cache');
const rutaSinRed = argumento('--sin-red');
for (const mando of ['--grabar-cache', '--sin-red']) {
  if (process.argv.includes(mando) && !argumento(mando)?.trim()) {
    console.error(`${mando} necesita la ruta de la caché`);
    process.exit(2);
  }
}
if (rutaSinRed && process.argv.includes('--hibrida')) {
  console.error('--sin-red no admite --hibrida: la caché no lleva texto completo.');
  process.exit(2);
}
const narrar = process.argv.includes('--narrar');
const semilla = Number(argumento('--semilla') ?? 42);
if (!Number.isInteger(semilla)) {
  console.error(`--semilla debe ser un entero (recibido: ${argumento('--semilla')})`);
  process.exit(2);
}
if (!narrar && process.argv.includes('--semilla')) {
  console.error('--semilla solo vale con --narrar.');
  process.exit(2);
}
const loreTrozo = process.argv.includes('--lore-trozo');
const loreAlFinal = process.argv.includes('--lore-al-final');
const maxLoreChars = argumento('--max-lore-chars') === undefined ? undefined : Number(argumento('--max-lore-chars'));
const umbralAnclado = argumento('--umbral-anclado') === undefined ? undefined : Number(argumento('--umbral-anclado'));
if (maxLoreChars !== undefined && (!Number.isInteger(maxLoreChars) || maxLoreChars <= 0)) {
  console.error(`--max-lore-chars debe ser un entero mayor que 0 (recibido: ${argumento('--max-lore-chars')})`);
  process.exit(2);
}
if (umbralAnclado !== undefined && !(umbralAnclado >= 0 && umbralAnclado <= 2)) {
  console.error(`--umbral-anclado debe ser un número entre 0 y 2 (recibido: ${argumento('--umbral-anclado')})`);
  process.exit(2);
}
if (!narrar) {
  const sueltos = ['--lore-trozo', '--lore-al-final', '--max-lore-chars', '--umbral-anclado'].filter((m) => process.argv.includes(m));
  if (sueltos.length > 0) {
    console.error(`${sueltos.join(', ')} solo valen con --narrar.`);
    process.exit(2);
  }
}
if (narrar && rutaSinRed) {
  console.error('--narrar no admite --sin-red: la caché no lleva el texto de los trozos.');
  process.exit(2);
}
if (rutaSinRed && rutaGrabarCache) {
  console.error('--sin-red y --grabar-cache a la vez no tiene sentido: grabar necesita Ollama y la base.');
  process.exit(2);
}

let cfg: ConfigRag;
try {
  aplicarArgumentosRag(process.argv.slice(2));
  cfg = configRag();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
}

// `env.ts` lee IA_REGISTRO al cargarse (import dinámico, más abajo): se decide antes de cargarlo.
const rutaRegistro = argumento('--registro');
if (rutaRegistro) process.env.IA_REGISTRO = rutaRegistro;
else delete process.env.IA_REGISTRO;

const casos: CasoRag[] = rutasCasos.flatMap((ruta) =>
  readFileSync(ruta, 'utf8')
    .split('\n')
    .map((texto, i) => ({ texto, linea: i + 1 }))
    .filter(({ texto }) => texto.trim())
    .map(({ texto, linea }) => {
      try {
        return JSON.parse(texto) as CasoRag;
      } catch (err) {
        console.error(`${ruta}: línea ${linea} no es JSON válido (${err instanceof Error ? err.message : err})`);
        process.exit(2);
      }
    }),
);

const erroresDeCasos = [...validarCasos(casos), ...validarParejas(casos)];
if (erroresDeCasos.length > 0) {
  console.error(`${rutaCasos}: ${erroresDeCasos.length} errores en los casos (QA-328, QA-331):`);
  for (const e of erroresDeCasos) console.error(`  ${e}`);
  process.exit(2);
}

// Sin red no se carga la base, ni la recuperación (que la usa), ni la configuración de Ollama.
const { prisma } = rutaSinRed ? { prisma: null } : await import('../lib/prisma.js');
const { retrieveLore } = rutaSinRed ? { retrieveLore: null } : await import('../services/retrieval.js');
const { env } = rutaSinRed ? { env: null } : await import('../config/env.js');
const banco = narrar ? await import('./ragNarrar.js') : null;
const { ollamaGenerate } = narrar ? await import('../lib/ollama.js') : { ollamaGenerate: null };
const digestNarrador = narrar ? await digestDeOllama(env!.ollamaBaseUrl, env!.ollamaModelNarrador) : null;
const { busqueda: _busqueda, ...cfgIndice } = cfg;

const textoCache = rutaSinRed ? leerArchivoCache(rutaSinRed) : null;
let cacheCongelada: CacheRag | null = null;
if (rutaSinRed && textoCache !== null) {
  try {
    cacheCongelada = leerCache(textoCache, rutaSinRed);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  }
}

const resultados: ResultadoCaso[] = [];
let indice: Partial<ConfigIndice> | null = null;
let diferencias: string[] = [];
try {
  let worldId = '';
  if (prisma) {
    const world = await prisma.world.findFirst({ where: { slug: 'helek-sirik' } });
    if (!world) {
      console.error("No existe el mundo 'helek-sirik' en la base de datos: ¿falta el seed o apunta DATABASE_URL a otra base?");
      process.exit(2);
    }
    worldId = world.id;
    indice = (world.loreIndice as Partial<ConfigIndice> | null) ?? null;
  } else {
    indice = cacheCongelada?.cabecera.indice ?? null;
  }
  if (!indice) {
    console.error('Aviso: el índice del lore no guarda con qué se construyó (reindexado anterior a QA-330): no se comprueba.');
  } else {
    diferencias = diferenciasDeIndice(indice, cfgIndice);
    if (diferencias.length > 0) {
      console.error(`Los mandos de esta corrida no casan con el índice (reindexa con los mismos o pasa --ignorar-indice):`);
      for (const d of diferencias) console.error(`  ${d}`);
      if (!ignorarIndice) process.exit(2);
    }
  }
  if (cfg.busqueda === 'hibrida' && !indice?.texto_completo) {
    console.error('--hibrida necesita el texto completo de cada trozo, y este índice no lo tiene: reindexa (npm run reindex-lore).');
    process.exit(2);
  }
  for (const caso of casos) {
    const continente = caso.region ? continentForRegion(caso.region) : null;
    const excludeTags = continente ? [oppositeContinent(continente)] : [];
    const consulta = consultaDelCaso(caso);
    let trozos: { title: string; text?: string; distance: number | null }[];
    if (cacheCongelada) {
      try {
        trozos = buscarEnMemoria(cacheCongelada, textoConsulta(cfg, consulta), k, excludeTags);
      } catch (err) {
        console.error(`${caso.id}: ${err instanceof Error ? err.message : err}`);
        process.exit(2);
      }
    } else {
      trozos = await retrieveLore!(consulta, worldId, k, excludeTags);
    }
    const puesto = puestoDelPrimerEsperado(
      trozos.map((t) => t.title),
      caso.esperados,
    );
    const resultado: ResultadoCaso = { caso, puesto, consulta, devueltos: trozos.map((t) => ({ title: t.title, distance: t.distance })) };
    if (banco && ollamaGenerate && env) {
      // Con red, `retrieveLore` devuelve el texto de cada trozo; se queda aparte, `devueltos` no lo lleva.
      let paraPrompt = trozos as RetrievedLore[];
      if (loreTrozo) paraPrompt = await Promise.all(paraPrompt.map(async (t) => ({ ...t, text: await trozoDeLaFila(t.title, consulta, t.text) })));
      const armado = banco.armarPromptNarrador(paraPrompt, caso.pregunta, { maxLoreChars, loreAlFinal, umbralAnclado });
      const inicio = Date.now();
      const { text } = await ollamaGenerate({
        model: env.ollamaModelNarrador,
        prompt: armado.prompt,
        format: armado.format,
        maxTokens: 300,
        keepAlive: '1h',
        temperature: 0,
        seed: semilla,
        timeoutMs: 240_000,
        tarea: 'narrar',
        intento: 1,
      });
      const ms = Date.now() - inicio;
      console.error(`${caso.id}: narración en ${(ms / 1000).toFixed(1)} s`);
      resultado.narracion = {
        lore: armado.lore,
        poco_anclado: armado.pocoAnclado,
        ...banco.leerNarracion(text),
        modelo: env.ollamaModelNarrador,
        digest: digestNarrador,
        ms,
      };
    }
    resultados.push(resultado);
  }
  if (rutaGrabarCache && prisma) await grabarCache(rutaGrabarCache, prisma, worldId, indice);
} finally {
  await prisma?.$disconnect();
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
  const raiz = git(['rev-parse', '--show-toplevel']);
  const salida = salidaJson(
    {
      modelo: cfg.modelo,
      digest: cacheCongelada ? cacheCongelada.cabecera.digest : await digestDeOllama(env!.ollamaBaseUrl, cfg.modelo),
      busqueda: cfg.busqueda,
      fusion: cfg.busqueda === 'hibrida' ? `rrf-${RRF_K}` : null,
      topK: k,
      trozo: cfg.tamTrozo,
      solapamiento: cfg.solape,
      prefijo_consulta: cfg.prefijoConsulta,
      prefijo_documento: cfg.prefijoDocumento,
      texto_embebido: cfg.plantilla,
      forma_consulta: FORMA_CONSULTA,
      region_filter: 'si el caso trae región, se excluye el lore del continente contrario',
      index: indice,
      index_matches: indice ? diferencias.length === 0 : null,
      commit: git(['rev-parse', 'HEAD']),
      commit_dirty: git(['status', '--porcelain']) === null ? null : git(['status', '--porcelain']) !== '',
      cases_file: rutasCasos.map((r) => (raiz ? relative(raiz, r) : r)).join(','),
      indice: cacheCongelada ? 'congelado' : 'vivo',
      cache_hash: textoCache === null ? null : hashDeCache(textoCache),
      ...(narrar
        ? {
            narrador: {
              modelo: env!.ollamaModelNarrador,
              digest: digestNarrador,
              temperatura: 0,
              semilla,
              max_lore_chars: maxLoreChars ?? banco!.MAX_LORE_CHARS,
              lore_trozo: loreTrozo || null,
              lore_al_final: loreAlFinal || null,
              umbral_anclado: umbralAnclado ?? null,
            },
          }
        : {}),
    },
    indice?.indice_hash ?? cacheCongelada?.cabecera.indice_hash ?? null,
    resultados,
    k,
  );
  // Con `process.exit` justo después, una tubería podría quedarse con el JSON a medias: se espera a vaciarlo.
  await new Promise<void>((hecho) => process.stdout.write(`${JSON.stringify(salida, null, 2)}\n`, () => hecho()));
}

/// `--lore-trozo` (`QA-360`): el trozo del fragmento `titulo` más cercano a la consulta (como lo elegiría la base entre
/// sus filas). La base no guarda el trozo, así que se reconstruye de `loreChunks.ts` y se embebe (una vez por título).
const vectoresDeTrozos = new Map<string, Promise<{ trozo: string; vector: number[] }[]>>();
const vectoresDeConsultas = new Map<string, Promise<number[]>>();
async function trozoDeLaFila(titulo: string, consulta: string, textoEntero: string): Promise<string> {
  const { embed } = await import('../lib/embeddings.js');
  let candidatos = vectoresDeTrozos.get(titulo);
  if (!candidatos) {
    candidatos = Promise.all(banco!.trozosDelFragmento(cfg, titulo).map(async (t) => ({ trozo: t.trozo, vector: await embed(t.embebido, cfg.modelo) })));
    vectoresDeTrozos.set(titulo, candidatos);
  }
  const clave = textoConsulta(cfg, consulta);
  let vector = vectoresDeConsultas.get(clave);
  if (!vector) {
    vector = embed(clave, cfg.modelo);
    vectoresDeConsultas.set(clave, vector);
  }
  return banco!.trozoMasCercano(await candidatos, await vector) ?? textoEntero;
}

function leerArchivoCache(ruta: string): string {
  try {
    return readFileSync(ruta, 'utf8');
  } catch (err) {
    console.error(`No se puede leer la caché ${ruta}: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  }
}

/// `--grabar-cache` (`QA-358`): escribe la caché de `ruta` con el índice y las consultas de esta corrida (ver arriba).
async function grabarCache(ruta: string, prisma: Pick<PrismaClient, '$queryRaw'>, worldId: string, indiceGuardado: Partial<ConfigIndice> | null): Promise<void> {
  const { embed } = await import('../lib/embeddings.js');
  const filas = filasDelIndice(cfg);
  const hash = hashDelIndice(cfg.modelo, filas.map((f) => ({ titulo: f.titulo, texto: f.texto })));
  if (!indiceGuardado?.indice_hash || hash !== indiceGuardado.indice_hash) {
    console.error(
      `No se graba la caché: las filas de loreChunks.ts con estos mandos dan ${hash}, y el índice guardado en la base, ${indiceGuardado?.indice_hash ?? 'ninguno'} (¿lore cambiado sin reindexar?).`,
    );
    process.exit(2);
  }
  const titulos = await prisma.$queryRaw<{ title: string }[]>`SELECT DISTINCT title FROM "LoreChunk" WHERE "worldId" = ${worldId} ORDER BY title`;
  const ordenTitulos = titulos.map((t) => t.title);
  const cabecera: CabeceraCache = {
    tipo: 'cabecera',
    modelo: cfg.modelo,
    digest: await digestDeOllama(env!.ollamaBaseUrl, cfg.modelo),
    prefijo_consulta: cfg.prefijoConsulta,
    prefijo_documento: cfg.prefijoDocumento,
    texto_embebido: cfg.plantilla,
    trozo: cfg.tamTrozo,
    solapamiento: cfg.solape,
    indice_hash: hash,
    indice: indiceGuardado,
  };
  let existente: CacheRag | null = null;
  if (existsSync(ruta)) {
    try {
      existente = leerCache(readFileSync(ruta, 'utf8'), ruta);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(2);
    }
    const dif = diferenciasDeCabecera(existente.cabecera, cabecera);
    if (dif.length > 0) {
      console.error(`La caché ${ruta} ya existe y su cabecera no casa con esta corrida (bórrala o usa otra ruta):`);
      for (const d of dif) console.error(`  ${d}`);
      process.exit(2);
    }
  }
  const trozos =
    existente?.trozos ??
    (await filas.reduce<Promise<CacheRag['trozos']>>(async (previo, f) => {
      const acumulado = await previo;
      acumulado.push({ tipo: 'trozo', titulo: f.titulo, texto: f.texto, ...(f.region ? { region: f.region } : {}), vector: await embed(f.texto, cfg.modelo) });
      return acumulado;
    }, Promise.resolve([])));
  const yaEstaban = new Set((existente?.consultas ?? []).map((c) => c.texto));
  const nuevas: CacheRag['consultas'] = [];
  for (const texto of new Set(casos.map((c) => textoConsulta(cfg, consultaDelCaso(c))))) {
    if (!yaEstaban.has(texto)) nuevas.push({ tipo: 'consulta', texto, vector: await embed(texto, cfg.modelo) });
  }
  const cache = ordenarCache(
    { cabecera: existente?.cabecera ?? cabecera, trozos, consultas: fusionarConsultas(existente?.consultas ?? [], nuevas) },
    ordenTitulos,
  );
  writeFileSync(ruta, serializarCache(cache));
  console.error(`Caché escrita en ${ruta}: ${cache.trozos.length} trozos, ${cache.consultas.length} consultas (${nuevas.length} nuevas).`);
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
