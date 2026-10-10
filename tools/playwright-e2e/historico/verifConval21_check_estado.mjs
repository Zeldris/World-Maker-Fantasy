import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/verifConval21_check_estado.png', fullPage: true });
const buttons = await page.locator('button').all();
console.log('Botones:');
for (const b of buttons) {
  const t = (await b.innerText()).trim().replace(/\s+/g, ' ');
  if (t) console.log(' -', t);
}
await browser.close();
console.log('OK');
