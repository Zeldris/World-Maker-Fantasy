import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

async function leerZona() {
  const res = await fetch(`http://localhost:3001/saves/${SAVE_ID}/zona`);
  return res.json();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const brujula = page.locator('button[title="Moverte por la zona"]');
await brujula.click();
await page.waitForTimeout(1500);

const zonaAntes = await leerZona();
console.log('jugador ANTES:', JSON.stringify(zonaAntes.jugador));
console.log('puntos:', JSON.stringify(zonaAntes.puntos.map(p => ({ tipo: p.tipo, x: p.x, y: p.y, targetSlug: p.targetSlug }))));

// El punto FAUNA (gesgurio) está en coordenadas de mundo (125, 575) según /zona.
// El SVG tiene su propio viewBox; hay que mapear a coordenadas de pantalla. Buscamos el bounding box del SVG del mapa.
const svg = page.locator('svg').filter({ has: page.locator('image, rect, circle') }).first();
const box = await svg.boundingBox();
console.log('SVG bounding box:', JSON.stringify(box));

// Asumiendo viewBox 800x600 (documentado en memoria), escalar proporcionalmente.
const VIEWBOX_W = 800, VIEWBOX_H = 600;
const faunaWorldX = 125, faunaWorldY = 575;
const screenX = box.x + (faunaWorldX / VIEWBOX_W) * box.width;
const screenY = box.y + (faunaWorldY / VIEWBOX_H) * box.height;
console.log(`Clicando en pantalla (${screenX.toFixed(0)}, ${screenY.toFixed(0)}) para llegar al punto de fauna (${faunaWorldX},${faunaWorldY})`);

await page.mouse.click(screenX, screenY);
console.log('Clic enviado, esperando movimiento paso a paso...');

let colisionDetectada = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000);
  const z = await leerZona().catch(() => null);
  if (z) {
    process.stdout.write(`[t=${i+1}s] jugador=${JSON.stringify(z.jugador)}  `);
  }
}
console.log();

await page.screenshot({ path: 'checklist0922_22_tras_movimiento.png', fullPage: true });

const zonaDespues = await leerZona();
console.log('jugador DESPUÉS:', JSON.stringify(zonaDespues.jugador));

await browser.close();
