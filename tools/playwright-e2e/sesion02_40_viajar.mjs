import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Abrir el panel de Mapa para intentar viajar a otra zona.
await page.getByText('Mapa', { exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/sesion02_40_mapa_abierto.png', fullPage: true });
console.log('--- MAPA ABIERTO ---');
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
