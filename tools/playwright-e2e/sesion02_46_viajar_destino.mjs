import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

await page.getByText('Mapa', { exact: true }).first().click();
await page.waitForTimeout(2000);
const tabs = page.locator('button', { hasText: /^Mapa$/ });
await tabs.last().click();
await page.waitForTimeout(2000);

// Clicar sobre el destino "Paso de los Pilares Rotos" para ver qué pasa.
const destino = page.getByText('Paso de los Pilares Rotos', { exact: true });
console.log('destino count:', await destino.count());
await destino.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/sesion02_46_tras_clic_destino.png', fullPage: true });
console.log('--- TRAS CLIC EN DESTINO ---');
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
