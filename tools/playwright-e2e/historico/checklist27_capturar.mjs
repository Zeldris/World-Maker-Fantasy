import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('captur') || res.url().includes('atar')) {
    console.log(res.request().method(), res.url(), '->', res.status());
    try { console.log((await res.text()).slice(0, 800)); } catch (e) {}
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);

await page.getByRole('button', { name: /^capturar$/i }).click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/checklist27_01_tras_capturar.png', fullPage: true });

await browser.close();
