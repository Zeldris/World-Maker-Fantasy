import { chromium } from 'playwright';

const SAVE_ID = 'cmtegz0b4001qrieti2l0z1iu';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/verifConval16_check_pozo.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-2500));
const buttons = await page.locator('button').all();
console.log('--BOTONES--');
for (const b of buttons) {
  const text = (await b.innerText()).trim().replace(/\s+/g, ' ');
  if (text) console.log(' -', text);
}
await browser.close();
console.log('OK');
