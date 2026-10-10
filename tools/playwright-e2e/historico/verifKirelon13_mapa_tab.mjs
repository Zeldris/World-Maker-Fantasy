import { chromium } from 'playwright';

const SAVE_ID = 'cmtegz0b4001qrieti2l0z1iu';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const mapaBtn = page.getByRole('button', { name: /mapa/i }).first();
await mapaBtn.click({ timeout: 10000 });
await page.waitForTimeout(1000);

const mapaTab = page.getByRole('button', { name: /^mapa$/i });
await mapaTab.click({ timeout: 10000 });
await page.waitForTimeout(1500);

const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 2500));
await page.screenshot({ path: 'screenshots/verifKirelon13_mapa_tab.png', fullPage: true });

const buttons = await page.locator('button').all();
console.log('\nBotones visibles:');
for (const b of buttons) {
  const text = (await b.innerText()).trim().replace(/\s+/g, ' ');
  if (text) console.log(' -', text);
}

await browser.close();
console.log('OK');
