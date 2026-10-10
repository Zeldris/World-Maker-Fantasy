import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const interactuarBtn = page.getByRole('button', { name: /^interactuar$/i });
await interactuarBtn.waitFor({ state: 'visible', timeout: 10000 });
await interactuarBtn.click();
console.log('Pulsado INTERACTUAR, esperando respuesta...');

for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
}

await page.screenshot({ path: 'checklist0922_24_tras_interactuar.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
