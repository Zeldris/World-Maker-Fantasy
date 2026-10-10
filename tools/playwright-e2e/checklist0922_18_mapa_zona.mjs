import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// Abrir el modal de movimiento por el icono de brújula flotante
const brujula = page.locator('button[title="Moverte por la zona"]');
await brujula.waitFor({ state: 'visible', timeout: 10000 });
await brujula.click();
await page.waitForTimeout(1500);

await page.screenshot({ path: 'checklist0922_18_modal_zona.png', fullPage: true });
console.log('Modal de zona abierto, captura guardada.');

// Inspeccionar el lienzo/SVG del mapa para saber dónde clicar
const svgs = await page.locator('svg').all();
console.log(`SVGs encontrados: ${svgs.length}`);
for (const s of svgs) {
  const box = await s.boundingBox().catch(() => null);
  const visible = await s.isVisible().catch(() => false);
  if (visible && box) console.log(' - svg box:', JSON.stringify(box));
}

await browser.close();
