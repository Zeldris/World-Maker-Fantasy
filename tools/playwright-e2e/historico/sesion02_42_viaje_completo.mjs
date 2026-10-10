import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

await page.getByText('Mapa', { exact: true }).click();
await page.waitForTimeout(1500);

// Buscar un botón/enlace para cambiar de zona (fuera de "Zona" local).
const bodyText = await page.locator('body').innerText();
console.log('--- MAPA: buscando opciones de viaje ---');
console.log(bodyText.slice(0, 2000));

await page.screenshot({ path: 'screenshots/sesion02_42_mapa_viaje.png', fullPage: true });

await browser.close();
console.log('OK');
