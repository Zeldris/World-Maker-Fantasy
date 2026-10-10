import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);

const editableCount = await page.locator('[contenteditable="true"], textarea, input[type="text"]').count();
console.log('Elementos editables:', editableCount);
for (let i = 0; i < editableCount; i++) {
  const el = page.locator('[contenteditable="true"], textarea, input[type="text"]').nth(i);
  console.log(i, await el.evaluate(e => e.tagName), 'visible:', await el.isVisible());
}

await page.screenshot({ path: 'screenshots/checklist20_01_combate_actual.png', fullPage: true });

await browser.close();
