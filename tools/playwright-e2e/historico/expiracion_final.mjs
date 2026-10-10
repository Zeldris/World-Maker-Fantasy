import { chromium } from 'playwright';

const SAVE_ID = 'cmthp1jyu0009rij1xf2ri09m';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('/turn/')) {
    console.log(res.request().method(), res.url(), '->', res.status());
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const composer = page.locator('[contenteditable="true"]').first();
await composer.click();
await composer.fill('Estiro los brazos y respiro hondo.');
await page.waitForTimeout(500);

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
console.log('Actuar disabled:', await actuarBtn.isDisabled());
await actuarBtn.click();
console.log('Turno enviado, esperando hasta 40s...');
await page.waitForTimeout(40000);

await browser.close();
