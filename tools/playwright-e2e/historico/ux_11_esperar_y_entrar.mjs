import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
for (let i = 0; i < 10; i++) {
  const visible = await combatirBtn.isVisible().catch(() => false);
  console.log(`Intento ${i}: Combatir visible=${visible}`);
  if (visible) break;
  await page.waitForTimeout(5000);
}

if (await combatirBtn.isVisible().catch(() => false)) {
  await combatirBtn.click();
  await page.waitForTimeout(1500);
}

await page.screenshot({ path: 'screenshot-ux-combate-panel2.png', fullPage: false });

await browser.close();
