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

const zona = await leerZona();
console.log('jugador:', JSON.stringify(zona.jugador));
console.log('dinamicos:', JSON.stringify(zona.dinamicos));
console.log('puntos:', JSON.stringify(zona.puntos.map(p => ({tipo: p.tipo, x: p.x, y: p.y, slug: p.targetSlug}))));

await browser.close();
