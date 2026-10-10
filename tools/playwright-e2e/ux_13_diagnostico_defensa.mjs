import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.isVisible().catch(() => false)) {
  await combatirBtn.click();
  await page.waitForTimeout(1500);
}

await page.screenshot({ path: 'screenshot-ux-diagnostico-defensa.png', fullPage: false });

const buttons = await page.getByRole('button').all();
for (const btn of buttons) {
  const name = await btn.evaluate((el) => el.getAttribute('aria-label') || el.textContent?.trim() || '(sin nombre)');
  const visible = await btn.isVisible();
  const disabled = await btn.isDisabled().catch(() => false);
  if (visible) console.log(JSON.stringify(name), 'disabled=', disabled);
}

await browser.close();
