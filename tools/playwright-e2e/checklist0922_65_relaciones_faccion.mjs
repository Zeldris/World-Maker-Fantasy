import { chromium } from 'playwright';

const SAVE_ID = 'cmubqa3ev000iri4u4d4lcko6';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const reputacionBtn = page.locator('button', { hasText: 'Reputación' }).first();
await reputacionBtn.click();
await page.waitForTimeout(1500);

await page.screenshot({ path: 'checklist0922_65_reputacion.png', fullPage: true });

const buttons = await page.getByRole('button').all();
for (const b of buttons) {
  const name = await b.innerText().catch(() => '');
  const visible = await b.isVisible().catch(() => false);
  if (visible && /relacion/i.test(name)) console.log('botón:', JSON.stringify(name.trim()));
}

await browser.close();
