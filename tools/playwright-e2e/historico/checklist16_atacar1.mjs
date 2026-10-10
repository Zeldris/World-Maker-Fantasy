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

// Click en Buitre Cenizo #1 (ya seleccionado por defecto) y Actuar (ataque básico)
await page.getByText('Buitre Cenizo #1').first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /^actuar$/i }).nth(0).click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/checklist16_01_tras_atacar.png', fullPage: true });

await browser.close();
