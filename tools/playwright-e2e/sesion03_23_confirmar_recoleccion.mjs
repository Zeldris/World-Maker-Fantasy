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
await recogerBtn.click();
await page.waitForTimeout(1500);

// Pulsar el "+" junto a "Tótem de clan roto" (el segundo botón "+" visible).
const plusButtons = page.getByRole('button', { name: '+' });
console.log('botones + encontrados:', await plusButtons.count());
if (await plusButtons.count() >= 2) {
  await plusButtons.nth(1).click();
  await page.waitForTimeout(500);
}
const acceptBtn = page.getByRole('button', { name: /^ACEPTAR$/i });
await acceptBtn.click();
await page.waitForTimeout(3000);
console.log('--- TRAS ACEPTAR ---');
console.log(await page.locator('body').innerText());
await page.screenshot({ path: 'screenshots/sesion03_23_tras_confirmar.png', fullPage: true });

await browser.close();
console.log('OK');
