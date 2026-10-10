import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const sugerirBtn = page.getByRole('button', { name: /sugerir/i });
await sugerirBtn.first().click();
console.log('Esperando sugerencias (hasta 60s)...');
await page.waitForTimeout(60000);
await page.screenshot({ path: 'screenshots/sesion02_55_sugerencias_resultado.png', fullPage: true });
console.log('--- RESULTADO ---');
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
