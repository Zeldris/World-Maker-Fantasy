import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/verifConval52_antes_recarga.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-2500));
const buttons = await page.locator('button').all();
console.log('--BOTONES RELEVANTES--');
for (const b of buttons) {
  const t = (await b.innerText()).trim().replace(/\s+/g, ' ');
  if (/matar|capturar|clemente/i.test(t)) console.log(' -', t);
}
await browser.close();
console.log('OK');
