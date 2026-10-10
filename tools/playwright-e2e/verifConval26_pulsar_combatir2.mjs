import { chromium } from 'playwright';

const SAVE_ID = 'cmten4peu008aritr6km5hcc9';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.locator('button', { hasText: 'COMBATIR' }).last();
await combatirBtn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/verifConval26_pulsar_combatir2.png', fullPage: true });

const buttons = await page.locator('button').all();
console.log('Botones tras pulsar Combatir:');
for (const b of buttons) {
  const text = (await b.innerText()).trim().replace(/\s+/g, ' ');
  if (text) console.log(' -', text);
}
await browser.close();
console.log('OK');
