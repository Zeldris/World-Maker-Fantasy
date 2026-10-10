import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
});
page.on('response', async (res) => {
  if (res.url().includes('/cazar')) {
    console.log(res.request().method(), res.url(), '->', res.status());
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/checklist09_00_estado_inicial.png', fullPage: true });

// Abrir Habilidades > Generales > Cazar
await page.getByRole('button', { name: '✨ Habilidades' }).click();
await page.waitForTimeout(1000);
await page.getByText('Cazar', { exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/checklist09_01_modal_cazar.png', fullPage: true });

await browser.close();
