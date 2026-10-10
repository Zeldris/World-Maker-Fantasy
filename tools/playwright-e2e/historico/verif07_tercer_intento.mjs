import { chromium } from 'playwright';

const SAVE_ID = 'cmteh1ax3003frietev2anlpo';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
page.on('response', async (res) => {
  if (res.url().includes('/action') || res.url().includes('/turn') || res.url().includes('/saves/')) {
    console.log('[response]', res.status(), res.url());
  }
});
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
await campo.click();
await campo.fill('Continúo la persecución del Kirelon Arenoso, decidido a darle caza de una vez.');
await page.waitForTimeout(300);
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
console.log('actuar disabled antes de click:', await actuarBtn.isDisabled());
await actuarBtn.click();
console.log('--- turno enviado: tercer intento ---');
await page.waitForTimeout(5000);
await page.screenshot({ path: 'screenshots/verif07_tras_enviar.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-1500));

await browser.close();
console.log('OK');
