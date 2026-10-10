import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
const starButton = page.locator('button').filter({ hasText: '✨' });
await starButton.nth(1).click();
await page.waitForTimeout(1000);
const pergamino = page.locator('button').filter({ hasText: '📜' });
await pergamino.first().click();
await page.waitForTimeout(1500);

const buttons = page.getByRole('button', { name: /^aprender$/i });
console.log('cantidad botones Aprender:', await buttons.count());
for (let i = 0; i < await buttons.count(); i++) {
  const disabled = await buttons.nth(i).isDisabled();
  console.log(`botón ${i}: disabled=${disabled}`);
}
await browser.close();
