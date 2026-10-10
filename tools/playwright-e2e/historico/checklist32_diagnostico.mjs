import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('/turn/') || res.url().includes('/saves/')) {
    console.log(res.request().method(), res.url(), '->', res.status());
  }
});
page.on('requestfailed', (req) => {
  console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText);
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const composer = page.locator('[contenteditable="true"]').first();
await composer.click();
await composer.fill('Camino un rato por los alrededores estirando las piernas.');
await page.waitForTimeout(500);

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
await actuarBtn.click();
await page.waitForTimeout(5000);
await page.screenshot({ path: 'screenshots/checklist32_01_diagnostico.png', fullPage: true });

await browser.close();
