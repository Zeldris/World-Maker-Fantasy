import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.screenshot({ path: 'checklist0922_38_estado_post_victoria.png', fullPage: true });

const buttons = await page.getByRole('button').all();
for (const b of buttons) {
  const name = await b.innerText().catch(() => '');
  const visible = await b.isVisible().catch(() => false);
  if (visible && /saque|combatir/i.test(name)) console.log('botón:', JSON.stringify(name.trim()));
}

await browser.close();
