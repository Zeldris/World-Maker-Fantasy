import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('image-prompt')) {
    console.log(res.request().method(), res.url(), '->', res.status());
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Enciclopedia' }).click();
await page.waitForTimeout(1500);
await page.getByText('Facciones', { exact: true }).click();
await page.waitForTimeout(1500);
await page.getByText('ORCOS — HIJOS DEL ESTALLIDO').click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/banner_serhu_01_expandido.png', fullPage: true });

await browser.close();
