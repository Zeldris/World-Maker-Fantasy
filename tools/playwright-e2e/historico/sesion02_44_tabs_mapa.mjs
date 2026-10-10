import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

await page.getByText('Mapa', { exact: true }).first().click();
await page.waitForTimeout(2000);

// Listar todos los botones visibles dentro del drawer.
const buttons = await page.locator('button').allTextContents();
console.log('--- BOTONES VISIBLES ---');
console.log(JSON.stringify(buttons.filter(b => b.trim()), null, 1));

await browser.close();
console.log('OK');
