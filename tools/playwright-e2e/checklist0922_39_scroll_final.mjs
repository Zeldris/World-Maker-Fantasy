import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// Scroll al final del panel de "Tu personaje"
const logScroll = page.locator('.overflow-y-auto').first();
await logScroll.evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
await page.waitForTimeout(1000);

await page.screenshot({ path: 'checklist0922_39_scroll_final.png', fullPage: true });

const ht = await page.locator('body').innerText();
console.log('--- Últimos 1500 chars ---');
console.log(ht.slice(-1500));

const buttons = await page.getByRole('button').all();
for (const b of buttons) {
  const name = await b.innerText().catch(() => '');
  const visible = await b.isVisible().catch(() => false);
  if (visible && /saque|combatir|salir/i.test(name)) console.log('botón visible:', JSON.stringify(name.trim()));
}

await browser.close();
