import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.getByText('Habilidades', { exact: true }).click();
await page.waitForTimeout(1200);
const recogerBtn = page.getByText('Recoger', { exact: true }).first();
console.log('boton Recoger encontrado:', await recogerBtn.count());
if (await recogerBtn.count() > 0) {
  await recogerBtn.click();
  await page.waitForTimeout(1500);
  console.log('--- TRAS PULSAR RECOGER ---');
  console.log(await page.locator('body').innerText());
}
await page.screenshot({ path: 'screenshots/sesion03_22_recolectar.png', fullPage: true });

await browser.close();
console.log('OK');
