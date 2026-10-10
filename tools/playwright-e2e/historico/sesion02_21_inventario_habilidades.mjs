import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
page.on('console', msg => { if (msg.type() === 'error') console.log('[console error]', msg.text()); });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

await page.getByText('Inventario', { exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/sesion02_21_inventario.png', fullPage: true });
console.log('--- INVENTARIO ---');
console.log(await page.locator('body').innerText());

await page.getByText('Habilidades', { exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/sesion02_22_habilidades.png', fullPage: true });
console.log('--- HABILIDADES ---');
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
