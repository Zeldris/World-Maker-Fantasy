import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);

const clementeBtn = page.getByRole('button', { name: /^clemente$/i });
await clementeBtn.waitFor({ state: 'visible', timeout: 10000 });
await clementeBtn.click();
console.log('Pulsado CLEMENTE, esperando resolución...');

for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  const ht = await page.locator('body').innerText().catch(() => '');
  if (!/CONVALECIENTE/i.test(ht) || i === 39) {
    console.log(`[t=${i + 1}s] CONVALECIENTE ya no visible o timeout`);
    break;
  }
}

await page.screenshot({ path: 'checklist0922_15_tras_clemente.png', fullPage: true });
console.log('Screenshot guardado.');

await browser.close();
