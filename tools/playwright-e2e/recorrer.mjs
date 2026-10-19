// QA-103 (2026-10-19): pasa los recorridos de `recorridos/` y da una línea por recorrido (✓ o ✗ con el
// motivo). Cada comprobación jugando que vale la pena repetir se escribe una vez como recorrido y queda como
// prueba de regresión (`QA-64`: un hallazgo arreglado que vuelve). Uso: `bash tools/qa/recorrer.sh [filtro…]`.
//
// Un recorrido es un módulo `recorridos/<nombre>.mjs` con `export default { hallazgos, escenario, correr }`:
//   - `hallazgos`: los P-números o tareas que comprueba (para la matriz y el registro de hallazgos).
//   - `escenario`: la instantánea de `tools/qa/escenarios/` que necesita (se carga si no es la cargada).
//   - `correr({ page, ayuda, api, sql, partida })`: lanza la excepción si algo no cuadra; lo que devuelva
//     sale junto al ✓. `ayuda(nombre, tk)` corre una ayuda de `mcp/` (texto); `api(ruta, opciones)` llama al
//     backend; `sql(consulta)` consulta la base de juego.
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirPartida, BACK } from './lib.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..');
const URL_JUEGO = 'postgresql://tarkor:tarkor@localhost:5432/tarkor_juego';
const filtros = process.argv.slice(2);

const sql = (consulta) => execFileSync('psql', [URL_JUEGO, '-Atc', consulta], { encoding: 'utf8' }).trim();
const api = async (ruta, opciones = {}) => {
  const r = await fetch(BACK + ruta, { headers: { 'content-type': 'application/json' }, ...opciones });
  const cuerpo = await r.text();
  if (!r.ok) throw new Error(`${opciones.method ?? 'GET'} ${ruta} → ${r.status}: ${cuerpo.slice(0, 200)}`);
  return cuerpo ? JSON.parse(cuerpo) : null;
};
function partidaDe(escenario) {
  const fila = readFileSync(join(raiz, 'tools', 'qa', 'escenarios', 'README.md'), 'utf8').split('\n').find((l) => l.startsWith(`| \`${escenario}\` |`));
  if (!fila) throw new Error(`No hay escenario «${escenario}» (tools/qa/escenario.sh lista)`);
  return fila.split('|')[2].replace(/`/g, '').trim();
}
// El escenario se carga antes de cada recorrido: jugar a mano, `escenario.sh` o el recorrido anterior cambian la
// base, y cada uno tiene que empezar en la instantánea tal cual.
function cargar(escenario) {
  execFileSync('bash', [join(raiz, 'tools', 'qa', 'escenario.sh'), 'cargar', escenario], { stdio: 'ignore' });
}

const archivos = readdirSync(join(aqui, 'recorridos'))
  .filter((f) => f.endsWith('.mjs'))
  .filter((f) => filtros.length === 0 || filtros.some((t) => f.includes(t)))
  .sort();
const recorridos = [];
for (const f of archivos) recorridos.push({ nombre: f.replace(/\.mjs$/, ''), ...(await import(join(aqui, 'recorridos', f))).default });
recorridos.sort((a, b) => (a.escenario ?? '').localeCompare(b.escenario ?? '') || a.nombre.localeCompare(b.nombre));

let fallos = 0;
for (const r of recorridos) {
  let browser;
  try {
    if (r.escenario) cargar(r.escenario);
    const partida = r.escenario ? partidaDe(r.escenario) : process.env.SAVE_ID;
    const abierta = await abrirPartida(partida);
    browser = abierta.browser;
    const page = abierta.page;
    const ayuda = async (nombre, tk = {}) => {
      await page.evaluate((datos) => { window.tk = datos; }, tk);
      const fn = eval(readFileSync(join(aqui, 'mcp', `${nombre}.js`), 'utf8'));
      return fn(page);
    };
    const salida = await r.correr({ page, ayuda, api, sql, partida });
    console.log(`✓ ${r.nombre} (${(r.hallazgos ?? []).join(', ')})${salida ? ': ' + String(salida).split('\n')[0] : ''}`);
  } catch (e) {
    fallos++;
    console.log(`✗ ${r.nombre} (${(r.hallazgos ?? []).join(', ')}): ${String(e?.message ?? e).split('\n')[0]}`);
  } finally {
    await browser?.close();
  }
}
console.log(`${recorridos.length - fallos}/${recorridos.length} recorridos en verde`);
process.exit(fallos ? 1 : 0);
