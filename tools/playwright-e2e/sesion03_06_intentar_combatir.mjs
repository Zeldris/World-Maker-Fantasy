import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const combatBtn = page.getByRole('button', { name: /combatir/i });
console.log('botones Combatir encontrados:', await combatBtn.count());
if (await combatBtn.count() > 0) {
  await combatBtn.click();
  await page.waitForTimeout(1500);
  console.log('--- TRAS PULSAR COMBATIR ---');
  console.log(await page.locator('body').innerText());
} else {
  console.log('No hay botón Combatir visible. Body:');
  console.log(await page.locator('body').innerText());
}
await page.screenshot({ path: 'screenshots/sesion03_06_tras_combatir.png', fullPage: true });
await browser.close();
console.log('OK');
