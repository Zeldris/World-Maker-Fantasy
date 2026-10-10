import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const mapaBtn = page.getByRole('button', { name: /^mapa$/i });
await mapaBtn.click({ timeout: 10000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/verifConval31_ver_mapa.png', fullPage: true });

const buttons = await page.locator('button').all();
console.log('Botones:');
for (const b of buttons) {
  const t = (await b.innerText()).trim().replace(/\s+/g, ' ');
  if (t) console.log(' -', t);
}
await browser.close();
console.log('OK');
