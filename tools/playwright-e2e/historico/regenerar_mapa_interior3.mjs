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
await page.getByText('Lugares', { exact: true }).click();
await page.waitForTimeout(1500);
await page.getByText('LAS LLANURAS DEL VIENTO ROJO').click();
await page.waitForTimeout(1500);
await page.mouse.wheel(0, 800);
await page.waitForTimeout(500);
await page.getByText('Karot Veku — Ketg\'lukar').click();
await page.waitForTimeout(2000);

const regenBtn = page.getByRole('button', { name: /^regenerar$/i });
console.log('Botones Regenerar encontrados:', await regenBtn.count());
await regenBtn.last().scrollIntoViewIfNeeded();
await page.screenshot({ path: 'screenshots/regen3_00_antes_click.png', fullPage: true });

await regenBtn.last().click();
await page.waitForTimeout(8000);
await page.screenshot({ path: 'screenshots/regen3_01_tras_click.png', fullPage: true });

await browser.close();
