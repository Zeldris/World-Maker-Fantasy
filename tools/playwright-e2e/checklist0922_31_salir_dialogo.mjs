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

const salir = page.getByRole('button', { name: /^salir$/i });
await salir.waitFor({ state: 'visible', timeout: 10000 });
await salir.click();
console.log('Diálogo cerrado con Salir.');
await page.waitForTimeout(1500);

const brujula = page.locator('button[title="Moverte por la zona"]');
await brujula.click();
await page.waitForTimeout(1500);

const zona = await leerZona();
console.log('jugador actual:', JSON.stringify(zona.jugador));
console.log('puntos:', JSON.stringify(zona.puntos.map(p => ({ tipo: p.tipo, x: p.x, y: p.y, targetSlug: p.targetSlug }))));

const svg = page.locator('svg').filter({ has: page.locator('image, rect, circle') }).first();
const box = await svg.boundingBox();
const VIEWBOX_W = 800, VIEWBOX_H = 600;

const orco = zona.puntos.find(p => p.targetSlug === 'orco-enfurecido-hondonada');
if (orco) {
  // Clicar cerca (offset 30px en Y) para no tocar el pin directamente
  const targetWorldX = orco.x, targetWorldY = orco.y + 30;
  const screenX = box.x + (targetWorldX / VIEWBOX_W) * box.width;
  const screenY = box.y + (targetWorldY / VIEWBOX_H) * box.height;
  console.log(`Clicando cerca del Orco (${targetWorldX},${targetWorldY}) -> pantalla (${screenX.toFixed(0)},${screenY.toFixed(0)})`);
  await page.mouse.click(screenX, screenY);

  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    const z = await leerZona().catch(() => null);
    if (z) console.log(`[t=${i+1}s] jugador=${JSON.stringify(z.jugador)}`);
  }
} else {
  console.log('No se encontró el punto del Orco Enfurecido en la lista de puntos.');
}

await page.screenshot({ path: 'checklist0922_31_tras_mover.png', fullPage: true });
await browser.close();
