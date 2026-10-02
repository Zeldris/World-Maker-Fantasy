import 'dotenv/config';
import '../lib/setupFetch.js';
import os from 'node:os';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { env } from '../config/env.js';
import { ACCIONES_TIPICAS, estadisticas, formatearSegundos, medirStreamNarracion, parsearOpciones, type MedicionTurno } from './benchmarkTurnoLib.js';

/// Fase F del hito 0.1 — latencia de turno en la máquina real (la Steam Deck). Juega N turnos típicos
/// contra el backend y el Ollama de verdad, por HTTP como el juego, y mide cada fase:
///   - clasificar: POST /turn/classify
///   - resolver:   POST /turn/narrate hasta la primera línea del stream (todo lo que pasa antes de narrar)
///   - narrar:     de esa primera línea hasta `done` (generación de la narración)
/// Con los números se fija el objetivo de turno en el roadmap.
///
/// Uso (con el backend arrancado):
///   npm run benchmark-turno -- [--turnos 5] [--url http://localhost:3001] [--save <id>] [--conservar] [--salida informe.json]
/// Sin --save crea una partida nueva de Gorhorn y la borra al acabar (salvo --conservar).

const GORHORN = {
  worldSlug: 'helek-sirik',
  pregeneratedCharacterId: 'char-gorhorn',
  characterName: 'Gorhorn (benchmark)',
  characterArchetype: 'Superviviente del clan Maktor (Orco)',
  characterOrigin: 'Único superviviente de un clan orco de escasa relevancia.',
  characterMotivation: 'Que la muerte de su clan signifique algo.',
  attributes: { fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 },
  portraitInitial: 'G',
  introCharacterText: 'Gorhorn llega a las Llanuras del Viento Rojo.',
  introWorldText: 'El mundo sigue su curso.',
};

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body as T;
}

async function main() {
  const opciones = parsearOpciones(process.argv.slice(2), process.env);
  const { url } = opciones;
  const version = await fetch(`${url}/version`).then((r) => json<{ version: string }>(r)).catch(() => null);
  if (!version) throw new Error(`No responde el backend en ${url} — arráncalo antes (npm run dev).`);

  let saveId = opciones.saveId;
  let creada = false;
  if (!saveId) {
    const res = await fetch(`${url}/saves`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(GORHORN) });
    saveId = (await json<{ id: string }>(res)).id;
    creada = true;
  }

  console.log(`\nBenchmark de turno · backend ${version.version} · ${opciones.turnos} turnos · partida ${saveId}${creada ? ' (nueva)' : ''}\n`);
  const mediciones: MedicionTurno[] = [];
  try {
    for (let i = 0; i < opciones.turnos; i++) {
      const accion = ACCIONES_TIPICAS[i % ACCIONES_TIPICAS.length]!;
      const t0 = performance.now();
      const medicion: MedicionTurno = { accion, clasificarMs: 0, resolverMs: null, narrarMs: null, totalMs: 0, resultado: 'ok' };
      try {
        const clas = await json<{ classification: unknown; roll?: unknown; transit?: unknown; blocked?: unknown }>(
          await fetch(`${url}/turn/classify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saveId, action: accion, enCombate: false }) }),
        );
        const t1 = performance.now();
        medicion.clasificarMs = t1 - t0;
        if (clas.transit) medicion.resultado = 'transito';
        else if (clas.blocked) medicion.resultado = 'bloqueado';
        else {
          const res = await fetch(`${url}/turn/narrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saveId, action: accion, classification: clas.classification, roll: clas.roll, enCombate: false }),
          });
          if (!res.ok || !res.body) throw new Error(`narrate HTTP ${res.status}`);
          const { primeraLinea, fin, error } = await medirStreamNarracion(res.body, () => performance.now());
          if (error) medicion.resultado = `error: ${error}`;
          medicion.resolverMs = primeraLinea === null ? null : primeraLinea - t1;
          medicion.narrarMs = primeraLinea === null || fin === null ? null : fin - primeraLinea;
        }
      } catch (e) {
        medicion.resultado = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
      medicion.totalMs = performance.now() - t0;
      mediciones.push(medicion);
      console.log(
        `${String(i + 1).padStart(2)}. ${accion.padEnd(62)} clasificar ${formatearSegundos(medicion.clasificarMs).padStart(7)} · resolver ${formatearSegundos(medicion.resolverMs).padStart(7)} · narrar ${formatearSegundos(medicion.narrarMs).padStart(7)} · total ${formatearSegundos(medicion.totalMs).padStart(7)}${medicion.resultado === 'ok' ? '' : ` [${medicion.resultado}]`}`,
      );
    }
  } finally {
    if (creada && !opciones.conservar) await fetch(`${url}/saves/${saveId}`, { method: 'DELETE' }).catch(() => {});
  }

  const ok = mediciones.filter((m) => m.resultado === 'ok');
  const resumen = {
    clasificar: estadisticas(mediciones.map((m) => m.clasificarMs)),
    resolver: estadisticas(ok.flatMap((m) => (m.resolverMs === null ? [] : [m.resolverMs]))),
    narrar: estadisticas(ok.flatMap((m) => (m.narrarMs === null ? [] : [m.narrarMs]))),
    total: estadisticas(ok.map((m) => m.totalMs)),
  };
  console.log('\nResumen (mediana · p90 · máximo):');
  for (const [fase, e] of Object.entries(resumen)) {
    console.log(`  ${fase.padEnd(10)} ${e ? `${formatearSegundos(e.mediana)} · ${formatearSegundos(e.p90)} · ${formatearSegundos(e.max)} (n=${e.n})` : 'sin datos'}`);
  }

  const informe = {
    fecha: new Date().toISOString(),
    backend: version.version,
    maquina: { plataforma: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model ?? '?', nucleos: os.cpus().length, memoriaGb: Math.round(os.totalmem() / 1e9) },
    // Modelos según el .env de quien ejecuta el script (debería ser el mismo que el del backend).
    modelos: { narrador: env.ollamaModelNarrador, cronista: env.ollamaModelCronista },
    turnos: mediciones,
    resumen,
  };
  const salida = opciones.salida ?? `benchmark-turno-${informe.fecha.slice(0, 19).replace(/[:T]/g, '-')}.json`;
  writeFileSync(salida, JSON.stringify(informe, null, 2));
  console.log(`\nInforme guardado en ${salida}\n`);
}

main().catch((e) => {
  console.error(`\nBenchmark fallido: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
