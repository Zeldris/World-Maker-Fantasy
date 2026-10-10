import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.getByText('Compañeros', { exact: true }).click();
await page.waitForTimeout(1500);
console.log('--- COMPAÑEROS ---');
console.log(await page.locator('body').innerText());
await page.screenshot({ path: 'screenshots/sesion02_59_companeros.png', fullPage: true });

await browser.close();
console.log('OK');
