import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const salir = page.getByRole('button', { name: /^salir$/i });
if (await salir.isVisible().catch(() => false)) {
  await salir.click();
  await page.waitForTimeout(1500);
}

await page.screenshot({ path: 'checklist0922_93_antes_aceptar.png', fullPage: true });

const aceptarBtn = page.getByRole('button', { name: /^aceptar$/i });
await aceptarBtn.waitFor({ state: 'visible', timeout: 10000 });
await aceptarBtn.click();
console.log('Pulsado ACEPTAR (3ra muerte, deathCount 3->4), esperando...');
await page.waitForTimeout(10000);

await page.screenshot({ path: 'checklist0922_93_tras_aceptar.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
