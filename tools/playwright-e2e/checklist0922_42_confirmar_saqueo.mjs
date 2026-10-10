import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const saquearBtn = page.getByRole('button', { name: /^saquear$/i });
await saquearBtn.waitFor({ state: 'visible', timeout: 10000 });
await saquearBtn.click();
console.log('Pulsado SAQUEAR, esperando...');

await page.waitForTimeout(15000);

await page.screenshot({ path: 'checklist0922_42_tras_saquear_confirmado.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
