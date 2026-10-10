import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('/turn/')) {
    console.log(res.request().method(), res.url(), '->', res.status());
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const composer = page.locator('[contenteditable="true"]').first();
await composer.click();
await composer.fill('Reviso mi inventario y descanso un momento sin moverme.');
await page.waitForTimeout(500);

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
console.log('Actuar disabled:', await actuarBtn.isDisabled());
await actuarBtn.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/checklist30_01_enviado.png', fullPage: true });

await browser.close();
