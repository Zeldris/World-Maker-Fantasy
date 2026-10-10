import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto('http://localhost:5173/solitario/mundo/helek-sirik/personaje/char-gorhorn');
await page.waitForTimeout(1000);
await page.getByRole('button').filter({ hasText: 'Novato' }).filter({ hasText: 'Sin límite de muertes' }).click();
await page.waitForTimeout(500);
await page.locator('button', { hasText: '+ Nueva partida' }).click();

let bodyText = '';
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(3000);
  bodyText = await page.locator('body').innerText();
  console.log(`[t=${(i+1)*3}s] URL=${page.url()} len=${bodyText.length}`);
  if (!bodyText.includes('Cargando partida')) break;
}
await page.screenshot({ path: 'screenshots/verifDobleComillas01_estado_inicial.png', fullPage: true });
console.log('URL FINAL:', page.url());
console.log('BODY TEXT FINAL:\n', bodyText.slice(0, 3000));
await browser.close();
console.log('OK');
