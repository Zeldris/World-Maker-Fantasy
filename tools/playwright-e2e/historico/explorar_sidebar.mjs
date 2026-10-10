import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

const buttons = await page.locator('button').all();
for (const btn of buttons) {
  const text = (await btn.textContent().catch(() => '') || '').trim().replace(/\s+/g, ' ');
  const box = await btn.boundingBox().catch(() => null);
  if (text && box) console.log(`x=${Math.round(box.x)} y=${Math.round(box.y)} | "${text.slice(0, 40)}"`);
}
await browser.close();
