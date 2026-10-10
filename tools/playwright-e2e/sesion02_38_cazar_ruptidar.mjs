import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByText('Habilidades', { exact: true }).click();
await page.waitForTimeout(1000);
await page.getByText('Cazar', { exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/sesion02_38_antes_seleccionar.png', fullPage: true });
console.log('--- ANTES ---');
console.log(await page.locator('body').innerText());

// Selecciona el candidato (probablemente clic en la fila) y confirma con CAZAR.
await page.getByText('Ruptidar', { exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /^cazar$/i }).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/sesion02_38_tras_cazar.png', fullPage: true });
console.log('--- TRAS CAZAR ---');
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
