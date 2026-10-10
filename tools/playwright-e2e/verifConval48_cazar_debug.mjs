import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
page.on('response', async (res) => {
  if (res.url().includes('cazar')) {
    console.log(res.status(), res.request().method(), res.url());
    try {
      const body = await res.text();
      console.log('  body:', body.slice(0, 500));
    } catch {}
  }
});
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const habilidadesBtn = page.locator('button', { hasText: 'Habilidades' });
await habilidadesBtn.click();
await page.waitForTimeout(1000);

const cazarChip = page.getByText('Cazar', { exact: true });
await cazarChip.click();
await page.waitForTimeout(1500);

const checkbox = page.locator('input[type="checkbox"]').first();
await checkbox.click();
await page.waitForTimeout(500);

const modalCazarBtn = page.locator('button:has-text("CAZAR"):not(:has-text("Kirelon"))');
await modalCazarBtn.last().click();
console.log('--- Cazar confirmado ---');
await page.waitForTimeout(15000);
await page.screenshot({ path: 'screenshots/verifConval48_debug.png', fullPage: true });

await browser.close();
console.log('OK');
