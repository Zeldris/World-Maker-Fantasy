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

const svg = page.locator('svg').filter({ has: page.locator('image, rect, circle') }).first();
const box = await svg.boundingBox();
console.log('SVG bounding box:', JSON.stringify(box));

const VIEWBOX_W = 800, VIEWBOX_H = 600;
const orcoWorldX = 400, orcoWorldY = 130;
const screenX = box.x + (orcoWorldX / VIEWBOX_W) * box.width;
const screenY = box.y + (orcoWorldY / VIEWBOX_H) * box.height;
console.log(`Clicando en pantalla (${screenX.toFixed(0)}, ${screenY.toFixed(0)}) para llegar al Orco Enfurecido (${orcoWorldX},${orcoWorldY})`);

await page.mouse.click(screenX, screenY);
console.log('Clic enviado, moviéndose paso a paso...');

for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000);
  const z = await leerZona().catch(() => null);
  if (z) console.log(`[t=${i+1}s] jugador=${JSON.stringify(z.jugador)}`);
}

await page.screenshot({ path: 'checklist0922_27_tras_mover_al_orco.png', fullPage: true });
console.log('Captura final tomada.');

await browser.close();
