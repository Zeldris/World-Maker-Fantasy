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
const VIEWBOX_W = 800, VIEWBOX_H = 600;

const zona = await leerZona();
const gesgurio = zona.puntos.find(p => p.targetSlug === 'gesgurio' || p.slug === 'gesgurio') || { x: 260, y: 340 };
const targetX = gesgurio.x, targetY = gesgurio.y;
const screenX = box.x + (targetX / VIEWBOX_W) * box.width;
const screenY = box.y + (targetY / VIEWBOX_H) * box.height;
console.log(`Clicando hacia Gesgurio (${targetX},${targetY})`);
await page.mouse.click(screenX, screenY);

for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(1000);
  const z = await leerZona().catch(() => null);
  if (z) console.log(`[t=${i+1}s] jugador=${JSON.stringify(z.jugador)}`);
}

await page.screenshot({ path: 'checklist0922_83_tras_mover.png', fullPage: true });
await browser.close();
