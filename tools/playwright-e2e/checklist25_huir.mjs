import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('huir') || res.url().includes('combat')) {
    console.log(res.request().method(), res.url(), '->', res.status());
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

const huirBtn = page.getByRole('button', { name: /^huir$/i });
console.log('Huir disabled:', await huirBtn.isDisabled());
await huirBtn.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/checklist25_01_tras_huir.png', fullPage: true });

await browser.close();
