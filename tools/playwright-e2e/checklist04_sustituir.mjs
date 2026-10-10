import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
});
page.on('response', async (res) => {
  if (res.url().includes('/inventario/') && res.request().method() === 'PATCH') {
    console.log('PATCH inventario status:', res.status());
    try {
      const body = await res.text();
      console.log('Body:', body);
    } catch (e) {}
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Personaje' }).click();
await page.waitForTimeout(1000);
await page.getByText('Hacha de g').click();
await page.waitForTimeout(1000);

await page.getByText('Espada corta goirntes').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/checklist04_01_tras_sustituir.png', fullPage: true });

await browser.close();
