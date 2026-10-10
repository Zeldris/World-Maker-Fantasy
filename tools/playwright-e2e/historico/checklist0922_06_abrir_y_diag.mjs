import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);

await page.screenshot({ path: 'checklist0922_06_panel_abierto.png', fullPage: true });

const inputs = await page.locator('input').all();
console.log(`Inputs encontrados: ${inputs.length}`);
for (const inp of inputs) {
  const ph = await inp.getAttribute('placeholder').catch(() => null);
  const visible = await inp.isVisible().catch(() => false);
  console.log(' - placeholder:', ph, 'visible:', visible);
}

const buttons = await page.getByRole('button').all();
for (const b of buttons) {
  const name = await b.innerText().catch(() => '');
  const visible = await b.isVisible().catch(() => false);
  if (visible && /actuar|orco/i.test(name)) console.log(' - botón relevante:', JSON.stringify(name.trim()));
}

await browser.close();
