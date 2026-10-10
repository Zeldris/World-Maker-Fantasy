import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.getByText('Habilidades', { exact: true }).click();
await page.waitForTimeout(1200);
const profesionesTab = page.getByText('Profesiones', { exact: true });
await profesionesTab.click();
await page.waitForTimeout(1000);
const tallarBtn = page.getByText('Tallar bloque de piedra', { exact: true });
console.log('boton Tallar encontrado:', await tallarBtn.count());
if (await tallarBtn.count() > 0) {
  await tallarBtn.first().click({ force: true });
  await page.waitForTimeout(1500);
  console.log('--- TRAS PULSAR TALLAR BLOQUE DE PIEDRA ---');
  console.log(await page.locator('body').innerText());
}
await page.screenshot({ path: 'screenshots/sesion03_28_crafteo_receta.png', fullPage: true });

await browser.close();
console.log('OK');
