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

// Cerrar cualquier modal de detalle que pudiera haber quedado abierto
const cancelar = page.getByRole('button', { name: /^cancelar$/i });
if (await cancelar.isVisible().catch(() => false)) {
  await cancelar.click();
  await page.waitForTimeout(500);
}

const svg = page.locator('svg').filter({ has: page.locator('image, rect, circle') }).first();
const box = await svg.boundingBox();

const VIEWBOX_W = 800, VIEWBOX_H = 600;
// Clicar a 30px de distancia del pin del Orco (400,130), no exactamente encima, para que sea "fondo" y no "pin"
const targetWorldX = 400, targetWorldY = 160;
const screenX = box.x + (targetWorldX / VIEWBOX_W) * box.width;
const screenY = box.y + (targetWorldY / VIEWBOX_H) * box.height;
console.log(`Clicando cerca del Orco en pantalla (${screenX.toFixed(0)}, ${screenY.toFixed(0)}) -> mundo (${targetWorldX},${targetWorldY})`);

await page.mouse.click(screenX, screenY);
console.log('Clic enviado, moviéndose paso a paso...');

for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(1000);
  const z = await leerZona().catch(() => null);
  if (z) console.log(`[t=${i+1}s] jugador=${JSON.stringify(z.jugador)}`);
}

await page.screenshot({ path: 'checklist0922_28_tras_mover_cerca.png', fullPage: true });
console.log('Captura final tomada.');

const ht = await page.locator('body').innerText();
console.log('--- Extracto final ---');
console.log(ht.slice(0, 800));

await browser.close();
