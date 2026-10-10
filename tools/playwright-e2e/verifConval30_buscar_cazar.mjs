import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const cazarCount = await page.getByText('Cazar', { exact: false }).count();
console.log('elementos con texto "Cazar":', cazarCount);
const els = await page.getByText('Cazar', { exact: false }).all();
for (const el of els) {
  console.log(' - tag:', await el.evaluate(e => e.tagName), 'text:', (await el.innerText()).slice(0,50));
}
await page.screenshot({ path: 'screenshots/verifConval30_buscar_cazar.png', fullPage: true });
await browser.close();
console.log('OK');
