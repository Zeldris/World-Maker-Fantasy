import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const salirBtn = page.getByRole('button', { name: /^salir$/i });
const visible = await salirBtn.isVisible().catch(() => false);
console.log('Botón SALIR visible?', visible);
if (visible) {
  await salirBtn.click();
  await page.waitForTimeout(2000);
}

await page.screenshot({ path: 'checklist0922_55_tras_salir.png', fullPage: true });

const ht = await page.locator('body').innerText();
console.log(ht.slice(0, 1000));

await browser.close();
