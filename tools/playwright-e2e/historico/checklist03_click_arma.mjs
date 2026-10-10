import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
});
page.on('response', (res) => {
  if (res.url().includes('/inventario/') && res.request().method() === 'PATCH') {
    console.log('PATCH inventario status:', res.status());
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Personaje' }).click();
await page.waitForTimeout(1000);

// Click en la ranura de Arma Principal (Hacha de guerra)
await page.getByText('Hacha de g').click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/checklist03_01_ranura_arma.png', fullPage: true });

await browser.close();
