import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

await page.getByText('Mapa', { exact: true }).click();
await page.waitForTimeout(2500);

// Buscar pestaña "Mapa" (amplio, distinto a "Zona") dentro del panel.
const mapaTab = page.getByText('Mapa', { exact: true }).last();
if (await mapaTab.count() > 1) {
  await page.locator('button:has-text("Mapa")').last().click().catch(() => {});
  await page.waitForTimeout(1500);
}

console.log('--- CONTENIDO PANEL ---');
console.log(await page.locator('body').innerText());
await page.screenshot({ path: 'screenshots/sesion02_43_mapa_amplio.png', fullPage: true });

await browser.close();
console.log('OK');
