import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.getByText('Enciclopedia', { exact: true }).click();
await page.waitForTimeout(1500);
await page.locator('button[title="Lugares"]').click();
await page.waitForTimeout(1200);
const regionBtn = page.locator('button.tactile', { hasText: 'LAS LLANURAS DEL VIENTO ROJO' });
await regionBtn.first().click({ force: true });
await page.waitForTimeout(1200);
console.log('--- LUGARES EXPANDIDOS ---');
console.log(await page.locator('body').innerText());

// Intentar clicar "Los Restos de Maktor" si aparece.
const restosBtn = page.getByText('Los Restos de Maktor', { exact: true });
if (await restosBtn.count() > 0) {
  await restosBtn.first().click({ force: true });
  await page.waitForTimeout(1200);
  console.log('--- DETALLE: LOS RESTOS DE MAKTOR ---');
  console.log(await page.locator('body').innerText());
}
await page.screenshot({ path: 'screenshots/sesion03_17_lugares_expandidos.png', fullPage: true });

await browser.close();
console.log('OK');
