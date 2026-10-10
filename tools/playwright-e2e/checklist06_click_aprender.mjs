import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
});
page.on('response', async (res) => {
  if (res.url().includes('aprender-oficio')) {
    console.log(res.request().method(), res.url(), '->', res.status());
    try { console.log('Body:', await res.text()); } catch (e) {}
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: '✨ Habilidades' }).click();
await page.waitForTimeout(1000);

await page.getByText('Aprender oficio').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/checklist06_01_modal.png', fullPage: true });

await browser.close();
