import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', msg => console.log('[console]', msg.type(), msg.text()));
page.on('pageerror', err => console.log('[pageerror]', err.message));
page.on('requestfailed', req => console.log('[requestfailed]', req.url(), req.failure()?.errorText));
page.on('response', async (res) => {
  const url = res.url();
  if (url.includes('localhost:3001')) {
    console.log('[response]', res.status(), res.request().method(), url);
  }
});
await page.goto('http://localhost:5173/solitario/mundo/helek-sirik/personaje/char-gorhorn');
await page.waitForTimeout(1000);
await page.getByRole('button').filter({ hasText: 'Novato' }).filter({ hasText: 'Sin límite de muertes' }).click();
await page.waitForTimeout(500);
await page.locator('button', { hasText: '+ Nueva partida' }).click();
await page.waitForTimeout(20000);
console.log('URL final:', page.url());
const bodyText = await page.locator('body').innerText();
console.log('BODY:', bodyText.slice(0, 500));
await page.screenshot({ path: 'screenshots/step11_debug.png', fullPage: true });
await browser.close();
console.log('OK');
