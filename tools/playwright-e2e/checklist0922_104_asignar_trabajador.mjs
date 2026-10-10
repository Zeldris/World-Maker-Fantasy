import { chromium } from 'playwright';

const SAVE_ID = 'cmubqa3ev000iri4u4d4lcko6';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const reinoBtn = page.locator('button', { hasText: 'Reino' }).first();
await reinoBtn.click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /producción/i }).click();
await page.waitForTimeout(1000);

await page.screenshot({ path: 'checklist0922_104_produccion_inicial.png', fullPage: true });

const buttons = await page.getByRole('button').all();
for (const b of buttons) {
  const name = await b.innerText().catch(() => '');
  const visible = await b.isVisible().catch(() => false);
  if (visible && name.trim()) console.log('botón:', JSON.stringify(name.trim()));
}

const selects = await page.locator('select').all();
console.log(`Selects encontrados: ${selects.length}`);
for (const s of selects) {
  const options = await s.locator('option').allTextContents();
  console.log(' - opciones:', options);
}

await browser.close();
