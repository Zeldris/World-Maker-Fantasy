import { chromium } from 'playwright';
const SAVE_ID = 'cmthr655x0003rilus98bdifu';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('response', async (res) => {
  if (res.url().includes('/turn/')) console.log(res.request().method(), res.url(), '->', res.status());
});
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
const composer = page.locator('[contenteditable="true"]').first();
await composer.click();
await composer.fill('Reviso mi equipo.');
await page.waitForTimeout(500);
const btn = page.getByRole('button', { name: /^actuar$/i }).last();
await btn.click();
console.log('Turno paralelo enviado.');
await page.waitForTimeout(3000);
await browser.close();
