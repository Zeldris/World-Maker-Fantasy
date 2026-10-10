import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('/cazar')) {
    console.log(res.request().method(), res.url(), '->', res.status());
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: '✨ Habilidades' }).click();
await page.waitForTimeout(1000);
await page.getByText('Cazar', { exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/bonus_00_modal_cazar.png', fullPage: true });

await browser.close();
