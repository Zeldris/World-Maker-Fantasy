import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.getByText('Personaje', { exact: true }).click();
await page.waitForTimeout(2000);
console.log('--- TRAS ABRIR PERSONAJE ---');
console.log((await page.locator('body').innerText()).slice(0, 300));

const statsBtn = page.locator('button', { hasText: 'Estadísticas' });
console.log('botones Estadísticas encontrados:', await statsBtn.count());
if (await statsBtn.count() > 0) {
  await statsBtn.first().click();
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: 'screenshots/sesion02_53_estadisticas.png', fullPage: true });
console.log('--- ESTADISTICAS ---');
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
