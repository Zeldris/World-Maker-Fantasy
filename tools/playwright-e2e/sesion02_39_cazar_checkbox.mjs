import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByText('Habilidades', { exact: true }).click();
await page.waitForTimeout(1000);
await page.getByText('Cazar', { exact: true }).click();
await page.waitForTimeout(1500);

const bodyBefore = await page.locator('body').innerText();
if (!bodyBefore.includes('Ruptidar')) {
  console.log('Ruptidar ya no está en la lista (posible timeout de avistamiento) — reintentando Explorar...');
  const explorarBtn = page.getByRole('button', { name: /explorar/i });
  if (await explorarBtn.count() > 0) {
    await explorarBtn.click();
    await page.waitForTimeout(2500);
  }
}

// Clic directo sobre el checkbox, no sobre el texto.
await page.locator('input[type="checkbox"]').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/sesion02_39_checkbox_marcado.png', fullPage: true });

const cazarBtn = page.getByRole('button', { name: /^cazar$/i });
await cazarBtn.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/sesion02_39_tras_confirmar.png', fullPage: true });
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
