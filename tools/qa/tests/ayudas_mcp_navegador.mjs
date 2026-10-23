// Tests de comportamiento de tools/playwright-e2e/mcp/pulsar.js y mover.js (QA-219) con Chromium de Playwright sobre
// tools/qa/tests/fixtures/ayudas-mcp.html. Cada ayuda es una expresión `async (page) => …` que lee `window.tk`.
// Uso: node ayudas_mcp_navegador.mjs  (código 2 = no hay Playwright/Chromium: el test de Python lo salta).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const aqui = dirname(fileURLToPath(import.meta.url));
const e2e = join(aqui, '..', '..', 'playwright-e2e');
let chromium, browser;
try {
  chromium = createRequire(join(e2e, 'package.json'))('playwright').chromium;
  browser = await chromium.launch();
} catch (e) {
  console.error('SIN NAVEGADOR: ' + String(e.message).split('\n')[0]);
  process.exit(2);
}
const AF = Object.getPrototypeOf(async function () {}).constructor;
const ayuda = async (n) => await new AF('return (' + readFileSync(join(e2e, 'mcp', n + '.js'), 'utf8') + ')')();
const html = readFileSync(join(aqui, 'fixtures', 'ayudas-mcp.html'), 'utf8');
const pulsar = await ayuda('pulsar');
const mover = await ayuda('mover');

const pruebas = [];
const test = (nombre, f) => pruebas.push([nombre, f]);
const nueva = async (tk) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(html);
  await page.evaluate((t) => { window.tk = t; }, tk);
  return page;
};
const pulsa = async (tk) => {
  const page = await nueva(tk);
  const salida = await pulsar(page);
  const pulsados = await page.evaluate(() => window.pulsados);
  await page.close();
  return { salida, pulsados };
};

// Orden de pasadas de pulsar: capa exacta, capa sin dígito, documento exacto, documento sin dígito.
test('pulsar: capa superior exacta gana al mismo texto de la página', async () => {
  const r = await pulsa({ texto: '1 Comer' });
  assert.deepEqual(r.pulsados, ['modal-1-comer']);
  assert.doesNotMatch(r.salida, /casó sin el número/);
});
test('pulsar: capa superior sin dígito gana al texto exacto de la página', async () => {
  const r = await pulsa({ texto: 'Reanudar' }); // «Reanudar» a secas está en la página; «1 Reanudar», en el modal
  assert.deepEqual(r.pulsados, ['modal-1-reanudar']);
  assert.match(r.salida, /casó sin el número/);
  assert.deepEqual((await pulsa({ texto: 'Comer' })).pulsados, ['modal-1-comer']);
});
test('pulsar: documento exacto gana al documento sin dígito', async () => {
  const r = await pulsa({ texto: 'Salir' }); // «3 Salir» va después en el documento
  assert.deepEqual(r.pulsados, ['pagina-salir']);
  assert.doesNotMatch(r.salida, /casó sin el número/);
});
test('pulsar: documento sin dígito como último recurso', async () => {
  const r = await pulsa({ texto: 'Huir' });
  assert.deepEqual(r.pulsados, ['pagina-4-huir']);
  assert.match(r.salida, /casó sin el número/);
});
test('pulsar: sin coincidencias da error claro', async () => {
  const r = await pulsa({ texto: 'Nada de esto' });
  assert.match(r.salida, /^ERROR: No hay nada visible con el texto «Nada de esto»/);
  assert.deepEqual(r.pulsados, []);
});
test('pulsar: falta el texto', async () => {
  assert.match((await pulsa({})).salida, /falta window\.tk\.texto/);
});
test('pulsar: contiene (cadena sola) busca parcial en la capa superior primero', async () => {
  const r = await pulsa({ contiene: 'Comer' });
  assert.deepEqual(r.pulsados, ['modal-1-comer']);
});

// mover: el svg del mapa. Un clic fuera del mapa devuelve su caja, así se ve cuál eligió.
const errorMover = async (tk, preparar) => {
  const page = await nueva(tk);
  if (preparar) await page.evaluate(preparar);
  const salida = await mover(page);
  await page.close();
  return salida;
};
test('mover: elige el svg grande del modal aunque el de la página sea mayor', async () => {
  assert.match(await errorMover({ x: 100, y: 400 }), /ERROR: \(100,400\) cae fuera del mapa, que ocupa x 700–1000,/);
});
test('mover: descarta los svg menores de 100×100 del modal y cae al de la página', async () => {
  const quitaGrande = () => document.getElementById('mapa-modal').remove();
  assert.match(await errorMover({ x: 700, y: 100 }, quitaGrande), /cae fuera del mapa, que ocupa x 20–440,/);
});
test('mover: sin modal usa el mapa de la página', async () => {
  const sinModal = () => document.getElementById('capa').remove();
  assert.match(await errorMover({ x: 700, y: 100 }, sinModal), /cae fuera del mapa, que ocupa x 20–440,/);
});
test('mover: faltan x e y', async () => {
  assert.match(await errorMover({}), /faltan window\.tk\.x y window\.tk\.y/);
});

let fallos = 0;
for (const [nombre, f] of pruebas) {
  try { await f(); console.log('ok   ' + nombre); } catch (e) { fallos++; console.log('FALLA ' + nombre + '\n  ' + String(e.message).split('\n').join('\n  ')); }
}
await browser.close();
console.log(`${pruebas.length - fallos}/${pruebas.length}`);
process.exit(fallos ? 1 : 0);
