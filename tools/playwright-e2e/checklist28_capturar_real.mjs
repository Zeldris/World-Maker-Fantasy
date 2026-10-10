import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('captur')) {
    console.log(res.request().method(), res.url(), '->', res.status());
    try {
      const req = res.request();
      console.log('body enviado:', req.postData());
      console.log('respuesta:', (await res.text()).slice(0, 800));
    } catch (e) {}
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/checklist28_00_antes.png', fullPage: true });

// Buscar la tarjeta "X ESTÁ CONVALECIENTE" y su botón Capturar específico
const tarjeta = page.locator('text=CONVALECIENTE').locator('xpath=ancestor::div[contains(@class,"border")]').first();
const capturarBtn = page.getByRole('button', { name: /^capturar$/i });
console.log('Botones Capturar:', await capturarBtn.count());
await capturarBtn.first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/checklist28_01_tras_click.png', fullPage: true });

await browser.close();
