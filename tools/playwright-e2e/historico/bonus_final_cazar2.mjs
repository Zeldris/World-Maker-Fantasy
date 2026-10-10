import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('/cazar')) {
    console.log(res.request().method(), res.url(), '->', res.status());
    try { console.log((await res.text()).slice(0, 300)); } catch (e) {}
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: '✨ Habilidades' }).click();
await page.waitForTimeout(1000);
await page.getByText('Cazar', { exact: true }).click();
await page.waitForTimeout(1000);

await page.getByText('Canizor ×').click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'CAZAR' }).click();
await page.waitForTimeout(3000);

await browser.close();
