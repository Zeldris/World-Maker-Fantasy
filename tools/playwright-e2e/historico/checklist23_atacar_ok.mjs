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
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

await page.getByText('Buitre Cenizo #1').first().click();
await page.waitForTimeout(500);

const composer = page.locator('input[placeholder="O describe tu acción..."]');
await composer.click();
await composer.fill("Ataco a 'Buitre Cenizo #1'.");
await page.waitForTimeout(500);

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
console.log('Actuar disabled:', await actuarBtn.isDisabled());
await actuarBtn.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/checklist23_01_tras_enviar.png', fullPage: true });

await browser.close();
