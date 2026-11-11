import 'dotenv/config';
import '../lib/setupFetch.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decidir, diferencias, parseCasos, type CasoClasificar } from './clasificarEval.js';

/// Evalúa la clasificación de la acción de la jugadora (QA-309, skill opt-ai): cada caso de
/// `backend/ia/clasificar-casos.jsonl` pasa por la cadena del turno (reglas de npcScene.ts + `classifyAction` con el
/// Ollama real + el apagado por saludo) y se compara con lo esperado, diciendo qué capa decidió.
/// Uso: npm run clasificar-eval -- [--casos <ruta>] [--registro <ruta>]
/// Sin Ollama no simula nada: sale con 2. Con algún caso en rojo sale con 1.
/// No incluye el `combateIniciado` del narrador (modelo grande), solo las reglas deterministas de combate.

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const rutaCasos = argumento('--casos') ?? fileURLToPath(new URL('../../ia/clasificar-casos.jsonl', import.meta.url));
const rutaRegistro = argumento('--registro');
if (rutaRegistro) process.env.IA_REGISTRO = rutaRegistro;
else delete process.env.IA_REGISTRO;

let casos: CasoClasificar[];
try {
  casos = parseCasos(readFileSync(rutaCasos, 'utf8'));
} catch (err) {
  console.error(`${rutaCasos}: ${err instanceof Error ? err.message : err}`);
  process.exit(2);
}

const { env } = await import('../config/env.js');
const { classifyAction } = await import('../services/narrador.js');

try {
  const r = await fetch(`${env.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
} catch (err) {
  console.error(`Ollama no responde (${err instanceof Error ? err.message : err}): clasificar-eval necesita el modelo real, no simula nada.`);
  process.exit(2);
}

const resumenPersonaje = 'Gorhorn Maktor, orco Cazador, nivel 3. Fuerza 14, Destreza 10, Voluntad 9, Carisma 8. Condición física: SANO.';
let aciertos = 0;
console.log(`Clasificar eval — ${casos.length} casos, modelo ${env.ollamaModelCronista}, ${rutaCasos}\n`);
for (const caso of casos) {
  let obtenido;
  try {
    obtenido = await decidir(caso, (accion) => classifyAction({ characterSummary: resumenPersonaje, action: accion }));
  } catch (err) {
    console.error(`${caso.id}: el modelo falló (${err instanceof Error ? err.message : err}); no se simula.`);
    process.exit(2);
  }
  const dif = diferencias(caso, obtenido);
  if (dif.length === 0) aciertos++;
  const e = caso.esperado;
  console.log(`${dif.length === 0 ? 'OK   ' : 'ROJO '} ${caso.id} [${caso.origen}] «${caso.accion}»`);
  console.log(`       esperado: tirada=${e.tirada}${e.atributo ? `(${e.atributo})` : ''} saludo=${e.saludoOPregunta} amenaza=${e.amenaza} combate=${e.combate}`);
  console.log(
    `       obtenido: tirada=${obtenido.tirada}${obtenido.atributo ? `(${obtenido.atributo})` : ''} saludo=${obtenido.saludoOPregunta} amenaza=${obtenido.amenaza} combate=${obtenido.combate}`,
  );
  console.log(`       capas: tirada <- ${obtenido.capaTirada}; combate <- ${obtenido.capaCombate}`);
  for (const d of dif) console.log(`       FALLA ${d}`);
}
console.log(`\naciertos: ${aciertos}/${casos.length}`);
process.exit(aciertos === casos.length ? 0 : 1);
