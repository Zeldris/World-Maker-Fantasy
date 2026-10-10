import { chromium } from 'playwright';

const SAVE_ID = 'cmtegz0b4001qrieti2l0z1iu';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const buttons = await page.locator('button').all();
console.log('Botones visibles en la página:');
for (const b of buttons) {
  const text = (await b.innerText()).trim().replace(/\s+/g, ' ');
  if (text) console.log(' -', text);
}

await page.screenshot({ path: 'screenshots/verifConval06_botones.png', fullPage: true });
await browser.close();
console.log('OK');
