import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const sugerirBtn = page.getByRole('button', { name: /sugerir/i });
console.log('botones Sugerir:', await sugerirBtn.count());
await sugerirBtn.first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/sesion02_54_sugerir.png', fullPage: true });
console.log('--- TRAS PULSAR SUGERIR ---');
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
