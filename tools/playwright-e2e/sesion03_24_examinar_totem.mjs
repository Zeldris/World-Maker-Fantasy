import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.getByText('Inventario', { exact: true }).click();
await page.waitForTimeout(1500);
const totemBtn = page.getByText('Tótem de clan roto', { exact: true });
console.log('Tótem de clan roto encontrado:', await totemBtn.count());
if (await totemBtn.count() > 0) {
  await totemBtn.first().click();
  await page.waitForTimeout(1200);
  console.log('--- DETALLE TÓTEM DE CLAN ROTO ---');
  console.log(await page.locator('body').innerText());
}
await page.screenshot({ path: 'screenshots/sesion03_24_totem_detalle.png', fullPage: true });

await browser.close();
console.log('OK');
